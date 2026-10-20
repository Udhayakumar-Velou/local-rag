import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { EvaluatedJob } from './types';
import { computeCanonicalJobKey } from './evaluator';
import { isWithinFourDaysMax } from './linkedin-scraper';

const STORE_FILE_PATH = path.join(process.cwd(), 'data', 'job-leads.json');

export interface JobStoreState {
  lastScanAt: string | null;
  lastScanSummary: string | null;
  jobs: EvaluatedJob[];
}

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Keeps saved/applied jobs forever, and keeps inbox jobs only if they are <= 4 days old
 */
function pruneStaleInboxJobs(jobs: EvaluatedJob[]): EvaluatedJob[] {
  return jobs.filter((job) => {
    if (job.userStatus === 'saved' || job.userStatus === 'applied' || job.userStatus === 'interviewing') {
      return true;
    }
    return isWithinFourDaysMax('', job.publicationDate);
  });
}

function readLocalStore(): JobStoreState {
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const raw = fs.readFileSync(STORE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const rawJobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      return {
        lastScanAt: parsed.lastScanAt || null,
        lastScanSummary: parsed.lastScanSummary || null,
        jobs: pruneStaleInboxJobs(rawJobs),
      };
    }
  } catch (err) {
    console.warn('Error reading local job-leads.json:', err);
  }
  return { lastScanAt: null, lastScanSummary: null, jobs: [] };
}

function writeLocalStore(state: JobStoreState) {
  try {
    const dir = path.dirname(STORE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write local job-leads.json:', err);
  }
}

/**
 * Loads all stored jobs, merging Supabase Cloud records with local disk cache
 */
export async function loadStoredJobs(): Promise<JobStoreState> {
  const localState = readLocalStore();
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('job_leads')
        .select('*')
        .order('overall_score', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const cloudJobs: EvaluatedJob[] = pruneStaleInboxJobs(
          data.map((row: any) => ({
            ...(row.job_data as EvaluatedJob),
            userStatus: row.user_status || row.job_data?.userStatus || 'inbox',
          }))
        );

        const mergedState: JobStoreState = {
          lastScanAt: localState.lastScanAt || data[0]?.updated_at || null,
          lastScanSummary: localState.lastScanSummary,
          jobs: cloudJobs,
        };
        writeLocalStore(mergedState);
        return mergedState;
      }
    } catch {
      // Fallback to local store if table not yet migrated
    }
  }

  return localState;
}

/**
 * Converts a relative posted string (e.g. "52 minutes ago", "2 hours ago", "3 days ago")
 * into minutes so jobs can be sorted from lowest hour (newest) to highest (oldest).
 */
export function parsePostedAgeMinutes(publicationDate: string): number {
  const text = (publicationDate || '').toLowerCase().trim();
  if (!text || /just now|instant|today|aujourd'hui/i.test(text)) return 5;

  const minMatch = text.match(/(\d+)\s*(minute|minutes|min|mins)/i);
  if (minMatch) return parseInt(minMatch[1], 10);

  const hourMatch = text.match(/(\d+)\s*(hour|hours|hr|hrs|heure|heures)/i);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60;

  const dayMatch = text.match(/(\d+)\s*(day|days|jour|jours)/i);
  if (dayMatch) return parseInt(dayMatch[1], 10) * 1440;

  return 2880; // Default fallback (~2 days)
}

/**
 * Saves new or updated jobs with strict duplicate detection per Section 12,
 * marks previously existing jobs as 'Previously Seen' and newly discovered jobs as 'New',
 * and sorts from lowest hour (newest posted) to highest hour.
 */
export async function upsertEvaluatedJobs(
  incomingJobs: EvaluatedJob[],
  scanSummary?: string
): Promise<{
  addedCount: number;
  skippedCount: number;
  allJobs: EvaluatedJob[];
  lastScanAt: string;
}> {
  const currentState = await loadStoredJobs();
  // Mark all existing jobs from previous scans as 'Previously Seen' before processing the new scan
  const existingJobs = pruneStaleInboxJobs(
    currentState.jobs.map((j) => ({
      ...j,
      listingStatus: 'Previously Seen' as const,
    }))
  );

  const existingIds = new Set(existingJobs.map((j) => j.id));
  const existingCanonicalKeys = new Set(
    existingJobs.map((j) => computeCanonicalJobKey(j.companyName, j.exactJobTitle, j.city))
  );

  let addedCount = 0;
  let skippedCount = 0;
  const newlyAdded: EvaluatedJob[] = [];

  for (const job of incomingJobs) {
    if (!isWithinFourDaysMax('', job.publicationDate)) {
      continue;
    }
    const canonicalKey = computeCanonicalJobKey(job.companyName, job.exactJobTitle, job.city);
    const existingIndex = existingJobs.findIndex(
      (j) =>
        j.id === job.id ||
        computeCanonicalJobKey(j.companyName, j.exactJobTitle, j.city) === canonicalKey
    );

    if (existingIndex !== -1) {
      // If the existing job was only scored by heuristic and we now have a Gemini evaluation, upgrade it in place
      if (job.scoredBy === 'gemini' && existingJobs[existingIndex].scoredBy !== 'gemini') {
        existingJobs[existingIndex] = {
          ...job,
          id: existingJobs[existingIndex].id,
          userStatus: existingJobs[existingIndex].userStatus,
          listingStatus: 'Previously Seen',
        };
      } else {
        skippedCount++;
      }
      continue;
    }

    existingIds.add(job.id);
    existingCanonicalKeys.add(canonicalKey);
    newlyAdded.push({
      ...job,
      listingStatus: 'New',
    });
    addedCount++;
  }

  // Sort: Newly scraped ('New') first, then lowest posted hour/minute first, then English CV, then score
  const allJobs = [...newlyAdded, ...existingJobs].sort((a, b) => {
    const aIsNew = a.listingStatus === 'New' ? 1 : 0;
    const bIsNew = b.listingStatus === 'New' ? 1 : 0;
    if (aIsNew !== bIsNew) return bIsNew - aIsNew;

    const aAge = parsePostedAgeMinutes(a.publicationDate);
    const bAge = parsePostedAgeMinutes(b.publicationDate);
    if (aAge !== bAge) return aAge - bAge;

    const aIsEn = a.recommendedCv === 'CV_EN.pdf' ? 1 : 0;
    const bIsEn = b.recommendedCv === 'CV_EN.pdf' ? 1 : 0;
    if (aIsEn !== bIsEn) return bIsEn - aIsEn;

    return b.overallScore - a.overallScore;
  });
  const nowIso = new Date().toISOString();

  const updatedState: JobStoreState = {
    lastScanAt: nowIso,
    lastScanSummary:
      scanSummary ||
      `Added ${addedCount} fresh jobs in France (<= 4 days old, ${skippedCount} duplicates skipped).`,
    jobs: allJobs,
  };

  writeLocalStore(updatedState);

  const supabase = getSupabaseServerClient();
  if (supabase && newlyAdded.length > 0) {
    try {
      const rows = newlyAdded.map((j) => ({
        id: j.id,
        canonical_key: computeCanonicalJobKey(j.companyName, j.exactJobTitle, j.city),
        job_data: j,
        user_status: j.userStatus,
        overall_score: j.overallScore,
        job_category: j.jobCategory,
        updated_at: nowIso,
      }));
      await supabase.from('job_leads').upsert(rows, { onConflict: 'id' });
    } catch {
      // Ignore if table not yet migrated in Supabase
    }
  }

  return {
    addedCount,
    skippedCount,
    allJobs,
    lastScanAt: nowIso,
  };
}

/**
 * Updates a job's status (inbox, saved, applied, archived)
 */
export async function updateStoredJobStatus(
  jobId: string,
  userStatus: EvaluatedJob['userStatus']
): Promise<EvaluatedJob[]> {
  const currentState = await loadStoredJobs();
  const updatedJobs = currentState.jobs.map((j) =>
    j.id === jobId
      ? {
          ...j,
          userStatus,
          appliedAt: userStatus === 'applied' ? new Date().toISOString() : j.appliedAt,
        }
      : j
  );

  writeLocalStore({
    ...currentState,
    jobs: updatedJobs,
  });

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const target = updatedJobs.find((j) => j.id === jobId);
      if (target) {
        await supabase
          .from('job_leads')
          .update({
            user_status: userStatus,
            job_data: target,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
    } catch {
      // Ignore if table not migrated yet
    }
  }

  return updatedJobs;
}
