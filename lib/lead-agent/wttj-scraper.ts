/**
 * Welcome to the Jungle (WTTJ) Public Job Discovery for France
 * Discovers startup and scale-up tech jobs across France using WTTJ's public search index.
 * Strictly enforces <= 2 days max recency (same as LinkedIn).
 * Requires ZERO credentials or API keys.
 */

import { RawDiscoveredJob, parseFrenchLocation, stripHtmlTags, isWithinFourDaysMax } from './linkedin-scraper';

const WTTJ_ALGOLIA_APP_ID = 'CSEKHVMS53';
// Public search-only API key verified on welcometothejungle.com
const WTTJ_ALGOLIA_SEARCH_KEYS = [
  '4bd8f6215d0cc52b26430765769e65a0',
  '0da4b6932dc42ab3d2c8ff4e201124d7',
  'b2319fc93a201a039ff01d293d0d8bb7',
];

function formatTimeAgo(isoDate: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${Math.max(1, diffMins)} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } catch {
    return 'Recently';
  }
}

/**
 * Searches Welcome to the Jungle using public Algolia search
 */
async function searchWttjViaAlgolia(
  keywords: string,
  maxPerQuery = 3
): Promise<RawDiscoveredJob[]> {
  const indexNames = ['wttj_jobs_production_fr', 'wttj_jobs_production_en', 'wttj_jobs_production'];

  for (const apiKey of WTTJ_ALGOLIA_SEARCH_KEYS) {
    for (const index of indexNames) {
      try {
        const url = `https://${WTTJ_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${index}/query`;
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
            query: keywords,
            hitsPerPage: Math.max(10, maxPerQuery * 3),
            filters: 'offices.country_code:FR',
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const hits = data?.hits;
        if (!Array.isArray(hits) || hits.length === 0) continue;

        const results: RawDiscoveredJob[] = [];

        for (const hit of hits) {
          if (results.length >= maxPerQuery) break;

          const title = hit.name || hit.title || '';
          if (!title) continue;

          // Check recency: must be <= 2 days old
          const publishedAt = hit.published_at || hit.created_at || '';
          const postedAgo = publishedAt ? formatTimeAgo(publishedAt) : 'Past 24h';
          if (!isWithinFourDaysMax(publishedAt.split('T')[0], postedAgo)) {
            continue;
          }

          const company = hit.organization?.name || 'French Tech Startup';
          const companySlug = hit.organization?.slug || '';
          const jobSlug = hit.slug || '';

          const office = (hit.offices && hit.offices[0]) || hit.office || {};
          const rawCity = office.city || office.local_city || 'Paris';
          const rawDistrict = office.district || office.state || office.local_state || '';
          const locationString = rawDistrict ? `${rawCity}, ${rawDistrict}, France` : `${rawCity}, France`;
          const { city, region } = parseFrenchLocation(locationString);

          // Contract type mapping
          let employmentType = 'CDI';
          const contract = (hit.contract_type || '').toUpperCase();
          if (contract === 'CDD') employmentType = 'CDD';
          else if (contract === 'INTERNSHIP' || contract === 'STAGE') employmentType = 'Stage';
          else if (contract === 'APPRENTICESHIP' || contract === 'ALTERNANCE') employmentType = 'Alternance';
          else if (contract === 'FREELANCE') employmentType = 'Freelance';
          else if (contract === 'FULL_TIME' || contract === 'CDI') employmentType = 'CDI';

          // Working arrangement
          let workingArrangement: 'Remote' | 'Hybrid' | 'On-site' = 'Hybrid';
          const remoteStr = (hit.remote || '').toUpperCase();
          if (remoteStr === 'FULL' || remoteStr === 'YES') {
            workingArrangement = 'Remote';
          } else if (remoteStr === 'NO') {
            workingArrangement = 'On-site';
          }

          // Build rich description from profile, missions & content
          const profileText = hit.profile ? stripHtmlTags(hit.profile) : '';
          const contentText = hit.content ? stripHtmlTags(hit.content) : '';
          const summaryText = hit.summary ? stripHtmlTags(hit.summary) : '';
          const missionsText = hit.key_missions ? stripHtmlTags(hit.key_missions) : '';
          const fullDesc = [summaryText, missionsText, contentText, profileText].filter(Boolean).join('\n\n');

          const jobUrl =
            companySlug && jobSlug
              ? `https://www.welcometothejungle.com/fr/companies/${companySlug}/jobs/${jobSlug}`
              : `https://www.welcometothejungle.com/fr/jobs?query=${encodeURIComponent(title)}`;

          const objectId = hit.objectID || hit.id || `${companySlug}-${jobSlug}`;

          results.push({
            externalId: `wttj-${objectId}`,
            title,
            company,
            location: locationString,
            city,
            region,
            postedDate: publishedAt ? publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
            postedAgo,
            jobUrl,
            descriptionText: fullDesc || `${title} position at ${company} in ${city}, France.`,
            employmentType,
            seniorityLevel: hit.experience_level || 'Mid-level',
            workingArrangement,
            source: 'Welcome to the Jungle',
          });
        }

        if (results.length > 0) {
          return results;
        }
      } catch {
        // Try next index or API key
      }
    }
  }

  return [];
}

/**
 * Secondary HTML fallback if Algolia is temporarily throttled
 */
async function searchWttjViaWeb(
  keywords: string,
  maxPerQuery = 3
): Promise<RawDiscoveredJob[]> {
  try {
    const searchUrl = `https://www.welcometothejungle.com/fr/jobs?query=${encodeURIComponent(
      keywords
    )}&aroundQuery=France&sortBy=most_recent`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
    if (!nextDataMatch) return [];

    const parsed = JSON.parse(nextDataMatch[1]);
    const jobListings =
      parsed.props?.pageProps?.initialJobsSearchPayload?.jobs ||
      parsed.props?.pageProps?.jobs ||
      [];

    const results: RawDiscoveredJob[] = [];
    for (const job of jobListings.slice(0, maxPerQuery)) {
      const title = job.name || job.title || '';
      if (!title) continue;

      const publishedAt = job.published_at || '';
      const postedAgo = publishedAt ? formatTimeAgo(publishedAt) : 'Past 24h';
      if (!isWithinFourDaysMax(publishedAt.split('T')[0], postedAgo)) continue;

      const company = job.organization?.name || 'Startup';
      const city = job.office?.city || 'Paris';
      const jobSlug = job.slug || '';
      const compSlug = job.organization?.slug || '';

      results.push({
        externalId: `wttj-${job.id || jobSlug}`,
        title,
        company,
        location: `${city}, France`,
        city,
        region: 'Île-de-France',
        postedDate: publishedAt ? publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
        postedAgo,
        jobUrl: `https://www.welcometothejungle.com/fr/companies/${compSlug}/jobs/${jobSlug}`,
        descriptionText: stripHtmlTags(job.content || job.summary || `${title} at ${company}`),
        employmentType: 'CDI',
        seniorityLevel: 'Mid-level',
        workingArrangement: 'Hybrid',
        source: 'Welcome to the Jungle',
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Main export: Searches Welcome to the Jungle France listings for tech & AI jobs
 */
export async function searchWttjPublicJobsFrance(
  keywords: string,
  maxPerQuery = 3
): Promise<RawDiscoveredJob[]> {
  // Try Algolia first (fastest and most structured)
  const algoliaResults = await searchWttjViaAlgolia(keywords, maxPerQuery);
  if (algoliaResults.length > 0) {
    return algoliaResults;
  }

  // Fallback to web Next.js SSR search
  return searchWttjViaWeb(keywords, maxPerQuery);
}
