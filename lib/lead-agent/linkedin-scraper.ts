/**
 * Authorized Public Job Discovery for All of France
 * Queries LinkedIn's public guest job search endpoints across France (Paris + all regional hubs).
 * Strictly enforces recency: Past 24 hours primary (r86400), with a maximum fallback of 2 days (r172800).
 * Rejects any job older than 2 days.
 */

export interface RawDiscoveredJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  city: string;
  region: string;
  postedDate: string;
  postedAgo: string;
  jobUrl: string;
  descriptionText: string;
  employmentType: string;
  seniorityLevel: string;
  workingArrangement: 'Remote' | 'Hybrid' | 'On-site';
  source: string;
}

// Prioritizes English queries while also including French equivalents to capture all of France
export const FRANCE_SEARCH_QUERIES = [
  { query: 'AI Engineer', categoryHint: 'AI Engineering' },
  { query: 'LLM Engineer Python', categoryHint: 'AI Engineering' },
  { query: 'Frontend Engineer React', categoryHint: 'React / Frontend' },
  { query: 'React TypeScript Developer', categoryHint: 'React / Frontend' },
  { query: 'Full Stack Engineer React Python', categoryHint: 'Combined AI + Software Engineering' },
  { query: 'Software Engineer AI React', categoryHint: 'Combined AI + Software Engineering' },
  { query: 'Développeur IA Python React', categoryHint: 'Combined AI + Software Engineering' },
];

// Nationwide locations across France so Paris is included without crowding out regional hubs
export const FRANCE_LOCATIONS = [
  'France', // Covers Paris, Île-de-France & France-wide Remote
  'Lyon, Auvergne-Rhône-Alpes, France',
  'Nantes, Pays de la Loire, France',
  'Bordeaux, Nouvelle-Aquitaine, France',
  'Toulouse, Occitanie, France',
  'Lille, Hauts-de-France, France',
  'Rennes, Brittany, France',
  'Nice, Provence-Alpes-Côte d’Azur, France',
];

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripHtmlTags(input: any): string {
  if (!input) return '';
  if (Array.isArray(input)) {
    return input.map((item) => stripHtmlTags(item)).filter(Boolean).join('\n');
  }
  if (typeof input === 'object') {
    return Object.values(input).map((val) => stripHtmlTags(val)).filter(Boolean).join(' ');
  }
  return decodeHtmlEntities(
    String(input)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

/**
 * Checks if a job posting is strictly within the 2-day maximum age threshold.
 * Rejects jobs posted 3+ days ago, weeks ago, or months ago.
 */
export function isWithinTwoDaysMax(postedDateIso: string, postedAgoText: string): boolean {
  const ago = (postedAgoText || '').toLowerCase();

  // Reject weeks or months immediately
  if (/\b(week|weeks|semaine|semaines|month|months|mois)\b/i.test(ago)) {
    return false;
  }

  // Check if "X days ago" or "il y a X jours" exceeds 2 days
  const daysMatch = ago.match(/(\d+)\s*(?:day|days|jour|jours)/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days > 2) return false;
  }

  // Also check ISO date if valid
  if (postedDateIso && /^\d{4}-\d{2}-\d{2}$/.test(postedDateIso)) {
    const postedTime = new Date(`${postedDateIso}T12:00:00Z`).getTime();
    const nowTime = Date.now();
    const diffDays = (nowTime - postedTime) / (1000 * 60 * 60 * 24);
    if (diffDays > 2.5) return false;
  }

  return true;
}

// Backward-compatibility alias
export const isWithinFourDaysMax = isWithinTwoDaysMax;

export function parseFrenchLocation(rawLoc: string): { city: string; region: string } {
  const cleaned = rawLoc.replace(/,?\s*France$/i, '').trim();
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);

  const cityToRegion: Record<string, string> = {
    paris: 'Île-de-France',
    'boulogne-billancourt': 'Île-de-France',
    courbevoie: 'Île-de-France',
    nanterre: 'Île-de-France',
    'saint-ouen': 'Île-de-France',
    'issy-les-moulineaux': 'Île-de-France',
    massy: 'Île-de-France',
    saclay: 'Île-de-France',
    nantes: 'Pays de la Loire',
    laval: 'Pays de la Loire',
    angers: 'Pays de la Loire',
    'le mans': 'Pays de la Loire',
    lyon: 'Auvergne-Rhône-Alpes',
    grenoble: 'Auvergne-Rhône-Alpes',
    'clermont-ferrand': 'Auvergne-Rhône-Alpes',
    lille: 'Hauts-de-France',
    bordeaux: 'Nouvelle-Aquitaine',
    toulouse: 'Occitanie',
    montpellier: 'Occitanie',
    rennes: 'Bretagne',
    brest: 'Bretagne',
    marseille: "Provence-Alpes-Côte d'Azur",
    nice: "Provence-Alpes-Côte d'Azur",
    sophia: "Provence-Alpes-Côte d'Azur",
    valbonne: "Provence-Alpes-Côte d'Azur",
    'aix-en-provence': "Provence-Alpes-Côte d'Azur",
    strasbourg: 'Grand Est',
    nancy: 'Grand Est',
    metz: 'Grand Est',
    rouen: 'Normandie',
    caen: 'Normandie',
    tours: 'Centre-Val de Loire',
    orléans: 'Centre-Val de Loire',
    dijon: 'Bourgogne-Franche-Comté',
  };

  if (parts.length >= 2) {
    const city = parts[0];
    const region = parts.slice(1).join(', ');
    return { city, region };
  }
  if (parts.length === 1) {
    const city = parts[0];
    const lower = city.toLowerCase();
    for (const [key, reg] of Object.entries(cityToRegion)) {
      if (lower.includes(key)) {
        return { city, region: reg };
      }
    }
    return { city, region: 'France' };
  }
  return { city: 'France (Remote)', region: 'All France' };
}

function inferWorkingArrangement(title: string, description: string, location: string): 'Remote' | 'Hybrid' | 'On-site' {
  const combined = `${title} ${description} ${location}`.toLowerCase();
  if (
    combined.includes('full remote') ||
    combined.includes('100% remote') ||
    combined.includes('fully remote') ||
    combined.includes('télétravail complet') ||
    combined.includes('télétravail total') ||
    location.toLowerCase() === 'france'
  ) {
    return 'Remote';
  }
  if (
    combined.includes('hybrid') ||
    combined.includes('hybride') ||
    combined.includes('télétravail partiel') ||
    combined.includes('days remote') ||
    combined.includes('jours de télétravail') ||
    combined.includes('télétravail')
  ) {
    return 'Hybrid';
  }
  return 'On-site';
}

/**
 * Fetches rich details & full "About the job" text for a specific LinkedIn public job ID
 */
export async function fetchLinkedInJobDetails(jobId: string): Promise<{
  descriptionText: string;
  employmentType: string;
  seniorityLevel: string;
}> {
  try {
    const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const res = await fetch(detailUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        descriptionText: '',
        employmentType: 'CDI / Full-time',
        seniorityLevel: 'Mid-level',
      };
    }

    const html = await res.text();

    const descMatch1 = html.match(
      /<div class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    const descMatch2 = html.match(
      /<section class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i
    );
    const descMatch3 = html.match(
      /<div class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    const descMatch4 = html.match(
      /<div class="[^"]*decoratedJobPosting__description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );

    const rawMarkup =
      (descMatch1 && descMatch1[1]) ||
      (descMatch2 && descMatch2[1]) ||
      (descMatch3 && descMatch3[1]) ||
      (descMatch4 && descMatch4[1]) ||
      '';

    const descriptionText = rawMarkup ? stripHtmlTags(rawMarkup).slice(0, 10000) : '';

    let employmentType = 'CDI / Full-time';
    const empMatch =
      html.match(
        /Employment type\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i
      ) ||
      html.match(
        /Type d’emploi\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i
      );
    if (empMatch) {
      employmentType = decodeHtmlEntities(empMatch[1]);
    }

    let seniorityLevel = 'Mid-level';
    const senMatch =
      html.match(
        /Seniority level\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i
      ) ||
      html.match(
        /Niveau hiérarchique\s*<\/h3>\s*<span class="[^"]*description__job-criteria-text[^"]*">([^<]+)<\/span>/i
      );
    if (senMatch) {
      seniorityLevel = decodeHtmlEntities(senMatch[1]);
    }

    return {
      descriptionText,
      employmentType,
      seniorityLevel,
    };
  } catch {
    return {
      descriptionText: '',
      employmentType: 'CDI / Full-time',
      seniorityLevel: 'Mid-level',
    };
  }
}

/**
 * Queries LinkedIn's public guest search API for jobs in a specific French location.
 * @param keywords Search query string
 * @param timeFilter 'r86400' (past 24h) or 'r172800' (past 2 days max)
 * @param maxPerQuery Max jobs to pull per query
 * @param location Target location in France (defaults to 'France')
 */
export async function searchLinkedInPublicJobsFrance(
  keywords: string,
  timeFilter: 'r86400' | 'r172800' | 'r345600' = 'r86400',
  maxPerQuery = 3,
  location = 'France'
): Promise<RawDiscoveredJob[]> {
  try {
    // sortBy=DD forces newest jobs first so Paris promoted ads don't bury fresh regional jobs
    const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
      keywords
    )}&location=${encodeURIComponent(location)}&f_TPR=${timeFilter}&sortBy=DD&start=0`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      return [];
    }

    const html = await res.text();
    const results: RawDiscoveredJob[] = [];

    const cardBlocks = html.split(/<li[^>]*>/i).slice(1);

    for (const block of cardBlocks) {
      if (results.length >= maxPerQuery) break;

      const urnMatch = block.match(/urn:li:jobPosting:(\d+)/);
      const jobId = urnMatch ? urnMatch[1] : '';
      if (!jobId) continue;

      const titleMatch = block.match(/<h3 class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
      const title = titleMatch ? stripHtmlTags(titleMatch[1]) : '';
      if (!title) continue;

      const companyMatch = block.match(/<h4 class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
      const company = companyMatch ? stripHtmlTags(companyMatch[1]) : 'Company in France';

      const locMatch = block.match(/<span class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const rawLocation = locMatch ? stripHtmlTags(locMatch[1]) : location;

      const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/i);
      const postedDate = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0];
      const postedAgo = dateMatch ? stripHtmlTags(dateMatch[2]) : 'Past 24h';

      // Strictly enforce <= 2 days maximum age!
      if (!isWithinTwoDaysMax(postedDate, postedAgo)) {
        continue;
      }

      const { city, region } = parseFrenchLocation(rawLocation);

      const linkMatch = block.match(/<a class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);
      const rawUrl = linkMatch
        ? decodeHtmlEntities(linkMatch[1].split('?')[0])
        : `https://www.linkedin.com/jobs/view/${jobId}/`;

      const details = await fetchLinkedInJobDetails(jobId);
      const workingArrangement = inferWorkingArrangement(title, details.descriptionText, rawLocation);

      results.push({
        externalId: `li-${jobId}`,
        title,
        company,
        location: rawLocation,
        city,
        region,
        postedDate,
        postedAgo,
        jobUrl: rawUrl,
        descriptionText:
          details.descriptionText ||
          `${title} position at ${company} located in ${rawLocation}, France.`,
        employmentType: details.employmentType,
        seniorityLevel: details.seniorityLevel,
        workingArrangement,
        source: 'LinkedIn France',
      });
    }

    return results;
  } catch (err) {
    console.warn(`Error searching LinkedIn (${location}) for "${keywords}":`, err);
    return [];
  }
}
