import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_GENERIC_MASTER_PROMPT } from './master-prompt';

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'data', 'lead-agent-settings.json');

export interface LeadAgentSettings {
  candidateName: string;
  candidateHeadline: string;
  cvEnName: string;
  cvFrName: string;
  geminiApiKey: string;
  scanFrequency: '6h' | '12h' | '24h';
  searchQueries: string[];
  masterPrompt: string;
}

const DEFAULT_SETTINGS: LeadAgentSettings = {
  candidateName: '',
  candidateHeadline: 'AI, React & Full-Stack Software Engineering',
  cvEnName: 'CV_EN.pdf',
  cvFrName: 'CV_FR.pdf',
  geminiApiKey: '',
  scanFrequency: '6h',
  searchQueries: [
    'AI Engineer',
    'LLM RAG Python',
    'React TypeScript',
    'Frontend Engineer React',
    'Full Stack React Python',
  ],
  masterPrompt: DEFAULT_GENERIC_MASTER_PROMPT,
};

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function readLocalSettings(): LeadAgentSettings {
  const envKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // Prioritize .env.local / Vercel Environment Variable first
        geminiApiKey: envKey || parsed.geminiApiKey || '',
      };
    }
  } catch (err) {
    console.warn('Could not read local lead-agent-settings.json:', err);
  }
  return {
    ...DEFAULT_SETTINGS,
    geminiApiKey: envKey,
  };
}

function writeLocalSettings(settings: LeadAgentSettings) {
  try {
    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write local lead-agent-settings.json:', err);
  }
}

/**
 * Loads settings from Supabase Cloud first, falling back to gitignored local settings.
 * SECURITY: Gemini API key is strictly read from server environment variables (.env.local / Vercel / GitHub Secrets)
 * or local gitignored file, NEVER from the public Supabase table.
 */
export async function loadLeadAgentSettings(): Promise<LeadAgentSettings> {
  const local = readLocalSettings();
  const envKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lead_agent_settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (!error && data) {
        const merged: LeadAgentSettings = {
          candidateName: data.candidate_name || local.candidateName,
          candidateHeadline: data.candidate_headline || local.candidateHeadline,
          cvEnName: data.cv_en_name || local.cvEnName,
          cvFrName: data.cv_fr_name || local.cvFrName,
          geminiApiKey: envKey || local.geminiApiKey,
          scanFrequency: (data.scan_frequency as any) || local.scanFrequency,
          searchQueries:
            Array.isArray(data.search_queries) && data.search_queries.length > 0
              ? data.search_queries
              : local.searchQueries,
          masterPrompt: data.master_prompt || local.masterPrompt,
        };
        writeLocalSettings(merged);
        return merged;
      } else if (!data && local.candidateName) {
        // Seed Supabase Cloud from local settings (excluding gemini_api_key for security)
        await supabase.from('lead_agent_settings').upsert(
          {
            id: 'default',
            candidate_name: local.candidateName,
            candidate_headline: local.candidateHeadline,
            cv_en_name: local.cvEnName,
            cv_fr_name: local.cvFrName,
            scan_frequency: local.scanFrequency,
            search_queries: local.searchQueries,
            master_prompt: local.masterPrompt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    } catch {
      // Fallback to local gitignored settings if Supabase table not yet created
    }
  }

  return local;
}

/**
 * Saves settings to Supabase Cloud (profile & prompt only) and gitignored local storage
 */
export async function saveLeadAgentSettings(
  updates: Partial<LeadAgentSettings>
): Promise<LeadAgentSettings> {
  const current = await loadLeadAgentSettings();
  const envKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const updated: LeadAgentSettings = {
    ...current,
    ...updates,
    geminiApiKey:
      updates.geminiApiKey !== undefined
        ? updates.geminiApiKey || envKey
        : current.geminiApiKey || envKey,
  };

  writeLocalSettings(updated);

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      // Never store gemini_api_key in the Supabase table
      await supabase.from('lead_agent_settings').upsert(
        {
          id: 'default',
          candidate_name: updated.candidateName,
          candidate_headline: updated.candidateHeadline,
          cv_en_name: updated.cvEnName,
          cv_fr_name: updated.cvFrName,
          scan_frequency: updated.scanFrequency,
          search_queries: updated.searchQueries,
          master_prompt: updated.masterPrompt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // Ignore if table not yet migrated in Supabase
    }
  }

  return updated;
}
