import { NextRequest, NextResponse } from 'next/server';
import {
  FRANCE_LOCATIONS,
  FRANCE_SEARCH_QUERIES,
  RawDiscoveredJob,
  searchLinkedInPublicJobsFrance,
} from '@/lib/lead-agent/linkedin-scraper';
import {
  computeCanonicalJobKey,
  evaluateDiscoveredJobWithGemini,
} from '@/lib/lead-agent/evaluator';
import { loadStoredJobs, upsertEvaluatedJobs } from '@/lib/lead-agent/store';
import { loadLeadAgentSettings } from '@/lib/lead-agent/settings';
import { EvaluatedJob } from '@/lib/lead-agent/types';

async function executeFranceJobDiscovery(apiKey?: string, customQueries?: string[]) {
  const settings = await loadLeadAgentSettings();
  const effectiveApiKey = apiKey || settings.geminiApiKey || undefined;
  const effectiveMasterPrompt = settings.masterPrompt || undefined;

  const existingState = await loadStoredJobs();
  const existingIds = new Set(existingState.jobs.map((j) => j.id));
  const existingCanonicalKeys = new Set(
    existingState.jobs.map((j) =>
      computeCanonicalJobKey(j.companyName, j.exactJobTitle, j.city)
    )
  );

  const queriesToRun =
    Array.isArray(customQueries) && customQueries.length > 0
      ? customQueries
      : Array.isArray(settings.searchQueries) && settings.searchQueries.length > 0
      ? settings.searchQueries
      : FRANCE_SEARCH_QUERIES.map((q) => q.query);

  const rawDiscovered: RawDiscoveredJob[] = [];
  const seenInBatch = new Set<string>();

  const addUniqueJobs = (items: RawDiscoveredJob[]) => {
    for (const item of items) {
      const canonical = computeCanonicalJobKey(item.company, item.title, item.city);
      if (
        !seenInBatch.has(item.externalId) &&
        !seenInBatch.has(canonical) &&
        !existingIds.has(item.externalId) &&
        !existingCanonicalKeys.has(canonical)
      ) {
        seenInBatch.add(item.externalId);
        seenInBatch.add(canonical);
        rawDiscovered.push(item);
      }
    }
  };

  // Phase 1: Nationwide France search (Past 24h primary, fallback to max 3-4 days r345600)
  for (const query of queriesToRun) {
    let found = await searchLinkedInPublicJobsFrance(query, 'r86400', 3, 'France');
    if (found.length < 2) {
      const fallbackFourDays = await searchLinkedInPublicJobsFrance(
        query,
        'r345600',
        3,
        'France'
      );
      found = [...found, ...fallbackFourDays];
    }
    addUniqueJobs(found);
  }

  // Phase 2: Multi-Region France Sweep (Lyon, Nantes, Bordeaux, Toulouse, Lille, Rennes, Nice)
  // Ensures regional French hubs are discovered alongside Paris (24h primary -> 3-4 days max)
  const regionalHubs = FRANCE_LOCATIONS.slice(1);
  const primaryEnglishQuery = queriesToRun[0] || 'Software Engineer React AI';

  for (const regionalLoc of regionalHubs) {
    let regionalFound = await searchLinkedInPublicJobsFrance(
      primaryEnglishQuery,
      'r86400',
      2,
      regionalLoc
    );
    if (regionalFound.length === 0) {
      regionalFound = await searchLinkedInPublicJobsFrance(
        primaryEnglishQuery,
        'r345600',
        2,
        regionalLoc
      );
    }
    addUniqueJobs(regionalFound);
  }

  // Evaluate up to 8 brand-new unique listings per scan
  const batchToEvaluate = rawDiscovered.slice(0, 8);
  const newlyEvaluated: EvaluatedJob[] = [];

  for (const rawJob of batchToEvaluate) {
    const evaluated = await evaluateDiscoveredJobWithGemini(
      rawJob,
      effectiveApiKey,
      effectiveMasterPrompt
    );
    newlyEvaluated.push(evaluated);
  }

  // Also upgrade up to 6 existing heuristic-scored jobs to Gemini AI if API key is now active
  let upgradedCount = 0;
  if (effectiveApiKey) {
    const heuristicJobsToUpgrade = existingState.jobs
      .filter((j) => j.userStatus !== 'archived' && j.scoredBy !== 'gemini')
      .slice(0, 6);

    for (const oldJob of heuristicJobsToUpgrade) {
      const upgraded = await evaluateDiscoveredJobWithGemini(
        {
          externalId: oldJob.id,
          title: oldJob.exactJobTitle,
          company: oldJob.companyName,
          location: `${oldJob.city}, ${oldJob.region}, France`,
          city: oldJob.city,
          region: oldJob.region,
          postedDate: oldJob.publicationDate,
          postedAgo: oldJob.publicationDate,
          jobUrl: oldJob.directApplicationUrl,
          descriptionText: `${oldJob.exactJobTitle} at ${oldJob.companyName} in ${oldJob.city}, ${oldJob.region}. Skills: ${oldJob.strongestMatchingSkills.join(', ')}. ${oldJob.geminiSummary}`,
          workingArrangement: oldJob.workingArrangement,
          employmentType: oldJob.employmentType,
          seniorityLevel: oldJob.seniorityLevel,
          source: 'LinkedIn France',
        },
        effectiveApiKey,
        effectiveMasterPrompt
      );
      if (upgraded.scoredBy === 'gemini') {
        newlyEvaluated.push(upgraded);
        upgradedCount++;
      }
    }
  }

  const evaluationMode = effectiveApiKey ? 'Gemini AI' : '100-pt Keyword Formula';
  const newCount = newlyEvaluated.length - upgradedCount;
  const summary =
    newCount > 0 || upgradedCount > 0
      ? `Discovered ${newCount} fresh jobs${upgradedCount > 0 ? ` & upgraded ${upgradedCount} existing jobs with Gemini AI` : ''} across All France (24h to 4d max • ${evaluationMode}).`
      : `Scanned All France (Paris + 7 regional hubs, <= 4 days old). All fresh listings are already in your dashboard.`;

  const stored = await upsertEvaluatedJobs(newlyEvaluated, summary);

  return {
    ...stored,
    discoveredCount: rawDiscovered.length,
    evaluatedCount: newlyEvaluated.length,
    upgradedCount,
    evaluationMode,
    summary,
  };
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.nextUrl.searchParams.get('apiKey') || undefined;
    const result = await executeFranceJobDiscovery(apiKey);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Scheduled scan error:', err);
    return NextResponse.json(
      { error: err?.message || 'Scheduled France job scan failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customQueries = body.quickQuery
      ? [String(body.quickQuery).trim()]
      : body.queries;
    const result = await executeFranceJobDiscovery(body.apiKey, customQueries);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Manual scan error:', err);
    return NextResponse.json(
      { error: err?.message || 'France job scan failed' },
      { status: 500 }
    );
  }
}
