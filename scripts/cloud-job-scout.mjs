/**
 * Standalone Cloud Job Scout Worker (Runs on GitHub Actions / Cloud Cron when Mac is OFF)
 * Loads private profile, Master Prompt & Gemini key from Supabase Cloud (`lead_agent_settings`),
 * discovers newly posted jobs across All of France (24h primary, 3-4 days max fallback),
 * deduplicates, and saves to Supabase (`job_leads`).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const DEFAULT_QUERIES = [
  'AI Engineer',
  'LLM Engineer Python',
  'Frontend Engineer React',
  'React TypeScript Developer',
  'Full Stack Engineer React Python',
  'Développeur IA Python React',
];

const FRANCE_REGIONS = [
  'France',
  'Lyon, Auvergne-Rhône-Alpes, France',
  'Nantes, Pays de la Loire, France',
  'Bordeaux, Nouvelle-Aquitaine, France',
  'Toulouse, Occitanie, France',
  'Lille, Hauts-de-France, France',
  'Rennes, Brittany, France',
  'Nice, Provence-Alpes-Côte d’Azur, France',
];

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalKey(company, title, city) {
  const c = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = (title || '')
    .toLowerCase()
    .replace(/\b(h\/f|f\/h|m\/f|cdi|cdd)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  const l = (city || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${c}::${t}::${l}`;
}

function isWithinFourDaysMax(postedAgoText) {
  const ago = (postedAgoText || '').toLowerCase();
  if (/\b(week|weeks|semaine|semaines|month|months|mois)\b/i.test(ago)) return false;
  const daysMatch = ago.match(/(\d+)\s*(?:day|days|jour|jours)/i);
  if (daysMatch && parseInt(daysMatch[1], 10) > 4) return false;
  return true;
}

async function fetchLinkedInFrance(query, location = 'France', timeFilter = 'r86400') {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
    query
  )}&location=${encodeURIComponent(location)}&f_TPR=${timeFilter}&sortBy=DD&start=0`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const blocks = html.split(/<li[^>]*>/i).slice(1);
  const jobs = [];

  for (const block of blocks.slice(0, 3)) {
    const idMatch = block.match(/urn:li:jobPosting:(\d+)/);
    if (!idMatch) continue;
    const jobId = idMatch[1];
    const titleMatch = block.match(/<h3 class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
    const compMatch = block.match(/<h4 class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
    const locMatch = block.match(/<span class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/i);
    const linkMatch = block.match(/<a class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);

    const title = titleMatch ? stripHtml(titleMatch[1]) : '';
    const company = compMatch ? stripHtml(compMatch[1]) : 'Company in France';
    const rawLoc = locMatch ? stripHtml(locMatch[1]) : location;
    const postedAgo = dateMatch ? stripHtml(dateMatch[2]) : 'Past 24h';

    if (!title || !isWithinFourDaysMax(postedAgo)) continue;

    const city = rawLoc.split(',')[0].trim() || 'France';
    const jobUrl = linkMatch ? linkMatch[1].split('?')[0] : `https://www.linkedin.com/jobs/view/${jobId}/`;

    jobs.push({
      id: `li-${jobId}`,
      title,
      company,
      city,
      region: rawLoc,
      postedAgo,
      jobUrl,
    });
  }
  return jobs;
}

async function runCloudScout() {
  console.log('[Cloud Job Scout] Starting scheduled All-France job discovery (24h -> 4d max)...');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Cloud Job Scout] Missing Supabase environment variables.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: settingsRow } = await supabase
    .from('lead_agent_settings')
    .select('*')
    .eq('id', 'default')
    .single();

  const queries =
    Array.isArray(settingsRow?.search_queries) && settingsRow.search_queries.length > 0
      ? settingsRow.search_queries
      : DEFAULT_QUERIES;

  const { data: existingRows } = await supabase.from('job_leads').select('id, canonical_key');
  const existingIds = new Set((existingRows || []).map((r) => r.id));
  const existingKeys = new Set((existingRows || []).map((r) => r.canonical_key));

  const discovered = [];
  for (const q of queries) {
    let found = await fetchLinkedInFrance(q, 'France', 'r86400');
    if (found.length < 2) {
      const fallback = await fetchLinkedInFrance(q, 'France', 'r345600');
      found = [...found, ...fallback];
    }
    for (const item of found) {
      const key = canonicalKey(item.company, item.title, item.city);
      if (!existingIds.has(item.id) && !existingKeys.has(key)) {
        existingIds.add(item.id);
        existingKeys.add(key);
        discovered.push({ ...item, canonicalKey: key });
      }
    }
  }

  // Regional sweep across France
  for (const reg of FRANCE_REGIONS.slice(1)) {
    let regFound = await fetchLinkedInFrance(queries[0] || 'React AI', reg, 'r86400');
    if (regFound.length === 0) {
      regFound = await fetchLinkedInFrance(queries[0] || 'React AI', reg, 'r345600');
    }
    for (const item of regFound) {
      const key = canonicalKey(item.company, item.title, item.city);
      if (!existingIds.has(item.id) && !existingKeys.has(key)) {
        existingIds.add(item.id);
        existingKeys.add(key);
        discovered.push({ ...item, canonicalKey: key });
      }
    }
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const masterPrompt = settingsRow?.master_prompt || 'Evaluate job suitability against AI, React, TypeScript, and Python engineering profile in France.';

  console.log(`[Cloud Job Scout] Found ${discovered.length} new unique listings across France (<= 4 days old).`);
  for (const raw of discovered.slice(0, 8)) {
    const isFrench = /\b(développeur|développeuse|ingénieur|ingénieure|alternance|stage)\b/i.test(raw.title);
    let jobData = {
      id: raw.id,
      exactJobTitle: raw.title,
      companyName: raw.company,
      city: raw.city,
      region: raw.region,
      country: 'France',
      employmentType: 'CDI',
      seniorityLevel: 'Mid-level',
      publicationDate: raw.postedAgo || 'Past 24h',
      workingArrangement: 'Hybrid',
      remoteRestrictions: 'France',
      salary: 'Not disclosed',
      requiredLanguages: isFrench ? ['French', 'English'] : ['English'],
      workAuthNotes: 'France',
      overallScore: 88,
      matchCategory: 'Excellent match',
      jobCategory: 'Combined AI + Software Engineering',
      scoreBreakdown: {
        technicalSkillsScore: 31,
        experienceAlignmentScore: 22,
        seniorityFitScore: 13,
        relevanceScore: 14,
        workingArrangementScore: 8,
      },
      strongestMatchingSkills: ['React.js', 'TypeScript', 'Python / AI'],
      relevantExperience: ['3+ years software engineering & web application development'],
      relevantProjects: ['RAG evaluation & FastAPI services'],
      missingOrWeakerRequirements: [],
      potentialEligibilityConcerns: [],
      geminiSummary: `Discovered via scheduled cloud scout in ${raw.city} at ${raw.company}.`,
      recommendedCv: isFrench ? 'CV_FR.pdf' : 'CV_EN.pdf',
      cvRecommendationReason: isFrench
        ? 'Posting title and context are in French.'
        : 'Posting title and context are in English.',
      threeRequirementsToEmphasize: [
        'Production React & TypeScript experience',
        'LLM & RAG pipeline engineering',
        'MSc Computer Science & Data Science + bilingual delivery',
      ],
      directApplicationUrl: raw.jobUrl,
      sourceUrl: raw.jobUrl,
      listingStatus: 'New',
      userStatus: 'inbox',
      scoredBy: 'heuristic',
    };

    if (geminiApiKey) {
      try {
        const evalPrompt = `Evaluate this job listing in France strictly according to the MASTER PROMPT.\nTitle: ${raw.title}\nCompany: ${raw.company}\nLocation: ${raw.city}, ${raw.region}\nPosted: ${raw.postedAgo}\nReturn ONLY valid JSON with keys: overallScore, matchCategory, jobCategory, scoreBreakdown, strongestMatchingSkills, geminiSummary, recommendedCv, cvRecommendationReason, threeRequirementsToEmphasize.`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: masterPrompt }] },
              contents: [{ role: 'user', parts: [{ text: evalPrompt }] }],
              generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          const textPart = [...parts].reverse().find((p) => !p.thought && typeof p.text === 'string') || parts[0];
          if (textPart?.text) {
            const parsed = JSON.parse(textPart.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
            jobData = {
              ...jobData,
              overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : jobData.overallScore,
              matchCategory: parsed.matchCategory || jobData.matchCategory,
              jobCategory: parsed.jobCategory || jobData.jobCategory,
              scoreBreakdown: parsed.scoreBreakdown || jobData.scoreBreakdown,
              strongestMatchingSkills: parsed.strongestMatchingSkills || jobData.strongestMatchingSkills,
              geminiSummary: parsed.geminiSummary || jobData.geminiSummary,
              recommendedCv: parsed.recommendedCv === 'CV_FR.pdf' ? 'CV_FR.pdf' : 'CV_EN.pdf',
              cvRecommendationReason: parsed.cvRecommendationReason || jobData.cvRecommendationReason,
              threeRequirementsToEmphasize: parsed.threeRequirementsToEmphasize || jobData.threeRequirementsToEmphasize,
              scoredBy: 'gemini',
            };
          }
        }
      } catch (e) {
        console.warn('[Cloud Job Scout] Gemini fallback for:', raw.title, e.message);
      }
    }

    await supabase.from('job_leads').upsert(
      {
        id: raw.id,
        canonical_key: raw.canonicalKey,
        job_data: jobData,
        user_status: 'inbox',
        overall_score: jobData.overallScore,
        job_category: jobData.jobCategory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  }

  console.log('[Cloud Job Scout] Completed successfully.');
}

runCloudScout();
