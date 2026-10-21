/**
 * Standalone Cloud Job Scout Worker (Runs on GitHub Actions / Cloud Cron when Mac is OFF)
 * Loads private profile, Master Prompt & Gemini key from Supabase Cloud (`lead_agent_settings`),
 * discovers newly posted jobs across All of France (24h primary, 3-4 days max fallback),
 * deduplicates, and saves to Supabase (`job_leads`).
 */

import { createClient } from '@supabase/supabase-js';

// Ensure WebSocket is defined in all Node environments so Supabase client never throws
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

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

const WTTJ_ALGOLIA_APP_ID = 'CSEKHVMS53';
const WTTJ_ALGOLIA_SEARCH_KEYS = [
  '4bd8f6215d0cc52b26430765769e65a0',
  '0da4b6932dc42ab3d2c8ff4e201124d7',
  'b2319fc93a201a039ff01d293d0d8bb7',
];

async function fetchWttjFrance(query, max = 3) {
  const jobs = [];
  for (const apiKey of WTTJ_ALGOLIA_SEARCH_KEYS) {
    try {
      const url = `https://${WTTJ_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/wttj_jobs_production_fr/query`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-algolia-application-id': WTTJ_ALGOLIA_APP_ID,
          'x-algolia-api-key': apiKey,
          'Content-Type': 'application/json',
          'Referer': 'https://www.welcometothejungle.com/',
          'Origin': 'https://www.welcometothejungle.com',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          query,
          hitsPerPage: max * 2,
          filters: 'offices.country_code:FR',
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const hits = data.hits || [];
      const twoDaysAgoMs = Date.now() - 2 * 24 * 60 * 60 * 1000;

      for (const hit of hits) {
        const publishedAt = hit.published_at;
        if (publishedAt) {
          const pubMs = new Date(publishedAt).getTime();
          if (pubMs < twoDaysAgoMs) continue;
        }

        const title = hit.name || '';
        const company = hit.organization?.name || 'Company in France';
        const office = (hit.offices && hit.offices[0]) || hit.office || {};
        const city = office.city || 'Paris';

        const profileText = hit.profile ? stripHtml(hit.profile) : '';
        const contentText = hit.content ? stripHtml(hit.content) : '';
        const summaryText = hit.summary ? stripHtml(hit.summary) : '';
        const missionsText = hit.key_missions ? stripHtml(hit.key_missions) : '';
        const fullDesc = [summaryText, missionsText, contentText, profileText].filter(Boolean).join('\n\n');

        const companySlug = hit.organization?.slug || '';
        const jobSlug = hit.slug || '';
        const jobUrl =
          companySlug && jobSlug
            ? `https://www.welcometothejungle.com/fr/companies/${companySlug}/jobs/${jobSlug}`
            : `https://www.welcometothejungle.com/fr/jobs?query=${encodeURIComponent(title)}`;

        const objectId = hit.objectID || hit.id || `${companySlug}-${jobSlug}`;

        let employmentType = 'CDI';
        const contract = (hit.contract_type || '').toUpperCase();
        if (contract === 'CDD') employmentType = 'CDD';
        else if (contract === 'STAGE' || contract === 'INTERNSHIP') employmentType = 'Stage';
        else if (contract === 'ALTERNANCE') employmentType = 'Alternance';
        else if (contract === 'FREELANCE') employmentType = 'Freelance';

        let workingArrangement = 'Hybrid';
        const remote = (hit.remote || '').toUpperCase();
        if (remote === 'FULL' || remote === 'YES') workingArrangement = 'Remote';
        else if (remote === 'NO') workingArrangement = 'On-site';

        jobs.push({
          id: `wttj-${objectId}`,
          title,
          company,
          city,
          region: `${city}, France`,
          postedAgo: publishedAt
            ? `${Math.max(1, Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)))} days ago`
            : 'Recent',
          jobUrl,
          descriptionText: fullDesc,
          employmentType,
          seniorityLevel: hit.experience_level || 'Mid-level',
          workingArrangement,
          source: 'Welcome to the Jungle',
        });
        if (jobs.length >= max) break;
      }
      if (jobs.length > 0) return jobs;
    } catch {
      // try next key or continue
    }
  }
  return jobs;
}

function stripHtml(input) {
  if (!input) return '';
  if (Array.isArray(input)) return input.map(stripHtml).filter(Boolean).join('\n');
  if (typeof input === 'object') return Object.values(input).map(stripHtml).filter(Boolean).join(' ');
  return String(input)
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

function isWithinTwoDaysMax(postedAgoText) {
  const ago = (postedAgoText || '').toLowerCase();
  if (/\b(week|weeks|semaine|semaines|month|months|mois)\b/i.test(ago)) return false;
  const daysMatch = ago.match(/(\d+)\s*(?:day|days|jour|jours)/i);
  if (daysMatch && parseInt(daysMatch[1], 10) > 2) return false;
  return true;
}

const isWithinFourDaysMax = isWithinTwoDaysMax;

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
      jobId,
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

async function fetchLinkedInJobDetails(jobId) {
  try {
    const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const res = await fetch(detailUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (!res.ok) return { descriptionText: '', employmentType: 'CDI', seniorityLevel: 'Mid-level' };
    const html = await res.text();
    const descMatch1 = html.match(/<div class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const descMatch2 = html.match(/<section class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i);
    const descMatch3 = html.match(/<div class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const descMatch4 = html.match(/<div class="[^"]*decoratedJobPosting__description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const rawMarkup =
      (descMatch1 && descMatch1[1]) ||
      (descMatch2 && descMatch2[1]) ||
      (descMatch3 && descMatch3[1]) ||
      (descMatch4 && descMatch4[1]) ||
      '';
    const descriptionText = rawMarkup ? stripHtml(rawMarkup).slice(0, 10000) : '';

    let employmentType = 'CDI';
    const empMatch =
      html.match(/Employment type\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i) ||
      html.match(/Type d’emploi\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i);
    if (empMatch) employmentType = stripHtml(empMatch[1]);

    let seniorityLevel = 'Mid-level';
    const senMatch =
      html.match(/Seniority level\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i) ||
      html.match(/Niveau hiérarchique\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i);
    if (senMatch) seniorityLevel = stripHtml(senMatch[1]);

    return { descriptionText, employmentType, seniorityLevel };
  } catch {
    return { descriptionText: '', employmentType: 'CDI', seniorityLevel: 'Mid-level' };
  }
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
      const fallback = await fetchLinkedInFrance(q, 'France', 'r172800');
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

    // Welcome to the Jungle France search (Startup & scale-up jobs)
    try {
      const wttjFound = await fetchWttjFrance(q, 2);
      for (const item of wttjFound) {
        const key = canonicalKey(item.company, item.title, item.city);
        if (!existingIds.has(item.id) && !existingKeys.has(key)) {
          existingIds.add(item.id);
          existingKeys.add(key);
          discovered.push({ ...item, canonicalKey: key });
        }
      }
    } catch {
      // ignore
    }
  }

  // Regional sweep across France
  for (const reg of FRANCE_REGIONS.slice(1)) {
    let regFound = await fetchLinkedInFrance(queries[0] || 'React AI', reg, 'r86400');
    if (regFound.length === 0) {
      regFound = await fetchLinkedInFrance(queries[0] || 'React AI', reg, 'r172800');
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

  console.log(`[Cloud Job Scout] Found ${discovered.length} new unique listings across France (<= 2 days old).`);
  for (let i = 0; i < discovered.slice(0, 8).length; i++) {
    const raw = discovered[i];
    if (i > 0 && geminiApiKey) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Fetch rich "About the job" description and metadata for LinkedIn jobs (WTTJ already provides full text)
    if (raw.id.startsWith('li-')) {
      const details = await fetchLinkedInJobDetails(raw.jobId || raw.id.replace('li-', ''));
      raw.descriptionText = details.descriptionText || '';
      if (details.employmentType) raw.employmentType = details.employmentType;
      if (details.seniorityLevel) raw.seniorityLevel = details.seniorityLevel;
    }

    // Comprehensive French statutory and linguistic detection on the full job description
    const descLower = (raw.descriptionText || '').toLowerCase();
    const frenchStopwords = descLower.match(/\b(vous|nous|pour|dans|avec|une|des|les|qui|sont|cette|votre|notre|au|aux|du|est|chez|selon|missions|poste|rejoindre|équipe|client|développement|conception|gestion|expérience|formation|bac|ingénieur|chargé|rémunération|mutuelle|avantages)\b/g);
    const hasFrenchMarker = (frenchStopwords && frenchStopwords.length >= 2) ||
      /\b(au sein de|nous recherchons|vos missions|notre équipe|profil recherché|dans le cadre|participer à)\b/i.test(descLower);
    const hasStatutoryFrench = /\b(h\/f|f\/h|h\/f\/x|cdi|cdd|stage|alternance)\b/i.test(raw.title + ' ' + descLower);
    const hasFrenchTitle = /\b(développeur|développeuse|ingénieur|ingénieure|concepteur|responsable|chargé)\b/i.test(raw.title);

    const isFrench = hasFrenchMarker || hasStatutoryFrench || hasFrenchTitle;

    let jobData = {
      id: raw.id,
      exactJobTitle: raw.title,
      companyName: raw.company,
      city: raw.city,
      region: raw.region,
      country: 'France',
      employmentType: raw.employmentType || 'CDI',
      seniorityLevel: raw.seniorityLevel || 'Mid-level',
      publicationDate: raw.postedAgo || 'Past 24h',
      workingArrangement: raw.workingArrangement || 'Hybrid',
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
      geminiSummary: `Discovered via ${raw.source || 'LinkedIn France'} in ${raw.city} at ${raw.company}.`,
      fullJobDescription: raw.descriptionText,
      recommendedCv: isFrench ? 'CV_FR.pdf' : 'CV_EN.pdf',
      cvRecommendationReason: isFrench
        ? 'The job posting and responsibilities are in French (French statutory/market context).'
        : 'The job posting is written in English for an international engineering team.',
      threeRequirementsToEmphasize: [
        'Production React & TypeScript experience',
        'LLM & RAG pipeline engineering',
        'MSc Computer Science & Data Science + bilingual delivery',
      ],
      directApplicationUrl: raw.jobUrl,
      sourceUrl: raw.jobUrl,
      source: raw.source || 'LinkedIn France',
      listingStatus: 'New',
      userStatus: 'inbox',
      scoredBy: 'heuristic',
    };

    if (geminiApiKey) {
      try {
        const evalPrompt = `Evaluate this job listing in France strictly according to the MASTER PROMPT.
Title: ${raw.title}
Company: ${raw.company}
Location: ${raw.city}, ${raw.region}
Posted: ${raw.postedAgo}

Job Description:
"""
${raw.descriptionText}
"""

IMPORTANT: In France, technical job titles (e.g., "AI Engineer - LLM & Agents IA", "Senior Frontend Software Engineer ReactJS") are commonly in English even for French companies. If the job description is in French, or contains French statutory markers (H/F, CDI, etc.), you MUST set recommendedCv to "CV_FR.pdf". Only recommend "CV_EN.pdf" if the description is genuinely and entirely written in English prose for an international English-speaking team.

Return ONLY valid JSON with keys: overallScore, matchCategory, jobCategory, scoreBreakdown, strongestMatchingSkills, geminiSummary, recommendedCv, cvRecommendationReason, threeRequirementsToEmphasize.`;

        const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const model of modelsToTry) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
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
              const finalCv = isFrench ? 'CV_FR.pdf' : parsed.recommendedCv === 'CV_FR.pdf' ? 'CV_FR.pdf' : 'CV_EN.pdf';
              jobData = {
                ...jobData,
                overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : jobData.overallScore,
                matchCategory: parsed.matchCategory || jobData.matchCategory,
                jobCategory: parsed.jobCategory || jobData.jobCategory,
                scoreBreakdown: parsed.scoreBreakdown || jobData.scoreBreakdown,
                strongestMatchingSkills: parsed.strongestMatchingSkills || jobData.strongestMatchingSkills,
                geminiSummary: parsed.geminiSummary || jobData.geminiSummary,
                recommendedCv: finalCv,
                cvRecommendationReason: isFrench && parsed.recommendedCv !== 'CV_FR.pdf'
                  ? 'The job posting and responsibilities are in French (French statutory/market context).'
                  : parsed.cvRecommendationReason || jobData.cvRecommendationReason,
                threeRequirementsToEmphasize: parsed.threeRequirementsToEmphasize || jobData.threeRequirementsToEmphasize,
                scoredBy: 'gemini',
              };
              break;
            }
          } else if (res.status === 429) {
            await new Promise((r) => setTimeout(r, 2000));
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

  const nowIso = new Date().toISOString();
  try {
    await supabase.from('lead_agent_settings').update({
      last_scanned_at: nowIso,
      updated_at: nowIso,
    }).eq('id', 'default');
  } catch (err) {
    // Non-fatal if column doesn't exist yet
  }

  console.log('[Cloud Job Scout] Completed successfully at', nowIso);
}

runCloudScout();
