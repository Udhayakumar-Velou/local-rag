import { EvaluatedJob, JobCategory, MatchCategory } from './types';
import { DEFAULT_GENERIC_MASTER_PROMPT } from './master-prompt';
import { RawDiscoveredJob } from './linkedin-scraper';

/**
 * Generates a normalized deduplication signature per Section 12 of the Master Prompt
 */
export function computeCanonicalJobKey(company: string, title: string, city: string): string {
  const normCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTitle = title
    .toLowerCase()
    .replace(/\b(h\/f|f\/h|m\/f|cdi|cdd|stage|alternance)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  const normCity = city.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normCompany}::${normTitle}::${normCity}`;
}

/**
 * Detects whether the posting is primarily English or French.
 * In the French tech market, English technical titles (e.g. "Senior Frontend Software Engineer ReactJS - Paris - H/F")
 * and technical keywords (React, TypeScript, Python) are used even when the job and company are French.
 * If the job description is in French, contains French statutory markers (H/F, F/H, CDI, CDD, etc.),
 * or French conversational text, CV_FR.pdf is recommended.
 * Only postings genuinely written in English prose should receive CV_EN.pdf.
 */
export function detectJobLanguageAndCv(title: string, description: string): {
  recommendedCv: 'CV_FR.pdf' | 'CV_EN.pdf';
  reason: string;
  languages: string[];
} {
  const titleLower = title.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const text = `${titleLower} ${descLower}`;

  // Statutory French labor markers (H/F, F/H, CDI, CDD, Alternance, Stage)
  const hasStatutoryFrenchMarker =
    /\b(h\/f|f\/h|h\/f\/x|cdi|cdd|stage|alternance)\b/i.test(titleLower) ||
    /\b(h\/f|f\/h|h\/f\/x|cdi|cdd)\b/i.test(descLower);

  // Explicit French job title keywords
  const hasExplicitFrenchTitle =
    /\b(développeur|développeuse|ingénieur|ingénieure|concepteur|conceptrice|responsable|chargé|chef de projet|stagiaire|alternant)\b/i.test(
      titleLower
    );

  // French grammatical & organizational markers (structural French phrases)
  const frenchMarkers = [
    'au sein de',
    'nous recherchons',
    'vos missions',
    'profil recherché',
    'notre équipe',
    'conception',
    'expérience',
    'télétravail',
    'maîtrise',
    'entreprise',
    'compétences',
    'rejoignez',
    'rejoindre',
    'rémunération',
    'mutuelle',
    'avantages',
    'poste basé',
    'vous ferez',
    'vous serez',
    'vous avez',
    'de formation',
    'bac+5',
    "école d'ingénieur",
    'dans le cadre',
    'participer à',
  ];

  // English structural phrases (conversational prose, NOT technical terms like react, developer, engineer)
  const englishMarkers = [
    'we are looking for',
    'responsibilities',
    'requirements',
    'qualifications',
    'what you will do',
    'about the role',
    'join our team',
    'you will be',
    'you have',
    'years of experience',
    'working with our',
    'equal opportunity',
    'benefits include',
  ];

  let frCount = 0;
  if (hasStatutoryFrenchMarker) frCount += 3;
  if (hasExplicitFrenchTitle) frCount += 3;

  for (const m of frenchMarkers) {
    if (text.includes(m)) frCount += 2;
  }

  // Count common French stopwords in description that never occur in English
  const frenchStopwords = descLower.match(/\b(vous|nous|pour|dans|avec|une|des|les|qui|sont|cette|votre|notre|au|aux|du|est|chez|selon)\b/g);
  if (frenchStopwords && frenchStopwords.length >= 2) {
    frCount += Math.min(frenchStopwords.length, 12);
  }

  let enCount = 0;
  for (const m of englishMarkers) {
    if (text.includes(m)) enCount += 2;
  }

  const englishStopwords = descLower.match(/\b(we|you|our|with|about|and|the|for|have|will|team)\b/g);
  if (englishStopwords && englishStopwords.length >= 3) {
    enCount += Math.min(englishStopwords.length, 10);
  }

  // Decision rule:
  // If French markers or stopwords dominate, or if statutory French marker (H/F, CDI) is present and English is not dominant:
  if (frCount >= enCount || (hasStatutoryFrenchMarker && frCount > 1)) {
    return {
      recommendedCv: 'CV_FR.pdf',
      reason: 'The job posting and responsibilities are in French (French statutory/market context). CV_FR.pdf is recommended for French recruitment.',
      languages: ['French (Fluent)', 'English (Professional)'],
    };
  }

  return {
    recommendedCv: 'CV_EN.pdf',
    reason: 'The job advertisement and responsibilities are written in English for an international engineering team.',
    languages: ['English (Fluent)', 'French (Plus)'],
  };
}

/**
 * Local JavaScript 100-point keyword rubric evaluator
 * Used when Gemini API key is not yet provided or rate-limited.
 */
export function evaluateJobHeuristicFallback(raw: RawDiscoveredJob): EvaluatedJob {
  const text = `${raw.title} ${raw.descriptionText}`.toLowerCase();
  const titleLower = raw.title.toLowerCase();

  const hasAi =
    /\b(ai|ia|llm|rag|genai|generative|nlp|machine learning|openai|gemini|langchain|agent|embeddings|vector)\b/i.test(
      text
    );
  const hasReactFrontend =
    /\b(react|next\.?js|typescript|frontend|front-end|javascript|ui|dashboard)\b/i.test(text);

  let jobCategory: JobCategory = 'Related Opportunities';
  if (hasAi && hasReactFrontend) {
    jobCategory = 'Combined AI + Software Engineering';
  } else if (
    /\b(ai|ia|llm|rag|genai|nlp|agent)\b/i.test(titleLower) ||
    (hasAi && !hasReactFrontend)
  ) {
    jobCategory = 'AI Engineering';
  } else if (hasReactFrontend) {
    jobCategory = 'React / Frontend';
  }

  // 1. Technical skills & responsibilities (/35)
  let technicalSkillsScore = 24;
  const matchedSkills: string[] = [];
  if (text.includes('react')) {
    technicalSkillsScore += 3;
    matchedSkills.push('React.js');
  }
  if (text.includes('typescript')) {
    technicalSkillsScore += 3;
    matchedSkills.push('TypeScript');
  }
  if (text.includes('python') || text.includes('fastapi')) {
    technicalSkillsScore += 3;
    matchedSkills.push('Python / FastAPI');
  }
  if (/\b(llm|rag|ai|ia|agent|embeddings)\b/i.test(text)) {
    technicalSkillsScore += 3;
    matchedSkills.push('LLM & RAG Applications');
  }
  if (text.includes('next.js') || text.includes('nextjs')) {
    technicalSkillsScore += 2;
    matchedSkills.push('Next.js');
  }
  if (text.includes('api') || text.includes('rest')) {
    matchedSkills.push('REST APIs');
  }
  if (text.includes('docker')) {
    matchedSkills.push('Docker');
  }
  technicalSkillsScore = Math.min(34, technicalSkillsScore);
  if (matchedSkills.length === 0) {
    matchedSkills.push('Software Engineering', 'Web Development', 'API Integration');
  }

  // 2. Experience alignment (/25)
  let experienceAlignmentScore = 20;
  if (jobCategory === 'Combined AI + Software Engineering') experienceAlignmentScore = 23;
  else if (jobCategory === 'React / Frontend' || jobCategory === 'AI Engineering')
    experienceAlignmentScore = 22;

  // 3. Seniority fit (/15)
  let seniorityFitScore = 13;
  let seniorityLevel: EvaluatedJob['seniorityLevel'] = 'Mid-level';
  if (/\b(junior|débutant|jeune diplômé|1-3|2 ans)\b/i.test(text)) {
    seniorityLevel = 'Junior';
    seniorityFitScore = 14;
  } else if (/\b(senior|lead|principal|staff|8\+|10\+|manager|director)\b/i.test(titleLower)) {
    seniorityLevel = 'Senior';
    seniorityFitScore = 10;
  }

  // 4. Relevance to AI, React, or Combined (/15)
  let relevanceScore = 10;
  if (jobCategory === 'Combined AI + Software Engineering') relevanceScore = 15;
  else if (jobCategory === 'AI Engineering' || jobCategory === 'React / Frontend')
    relevanceScore = 14;

  // 5. Working arrangement & France eligibility (/10)
  const workingArrangementScore = raw.workingArrangement === 'Remote' ? 9 : 8;

  const overallScore =
    technicalSkillsScore +
    experienceAlignmentScore +
    seniorityFitScore +
    relevanceScore +
    workingArrangementScore;

  let matchCategory: MatchCategory = 'Possible match';
  if (overallScore >= 85) matchCategory = 'Excellent match';
  else if (overallScore >= 70) matchCategory = 'Strong match';
  else if (overallScore < 55) matchCategory = 'Low priority';

  const cvInfo = detectJobLanguageAndCv(raw.title, raw.descriptionText);

  let empType: EvaluatedJob['employmentType'] = 'CDI';
  if (/part-time|temps partiel/i.test(raw.employmentType + ' ' + raw.title)) {
    empType = 'Part-time';
  } else if (/cdd/i.test(raw.employmentType + ' ' + raw.title)) {
    empType = 'CDD';
  } else if (/full-time|temps plein/i.test(raw.employmentType)) {
    empType = 'Full-time';
  }

  return {
    id: raw.externalId || `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exactJobTitle: raw.title,
    companyName: raw.company,
    city: raw.city,
    region: raw.region,
    country: 'France',
    employmentType: empType,
    seniorityLevel,
    publicationDate: raw.postedAgo || raw.postedDate,
    workingArrangement: raw.workingArrangement,
    remoteRestrictions:
      raw.workingArrangement === 'Remote'
        ? 'Remote permitted from France'
        : `${raw.workingArrangement} at ${raw.city} office`,
    salary: 'Not disclosed',
    requiredLanguages: cvInfo.languages,
    workAuthNotes: 'Position based in France',
    overallScore,
    matchCategory,
    jobCategory,
    scoreBreakdown: {
      technicalSkillsScore,
      experienceAlignmentScore,
      seniorityFitScore,
      relevanceScore,
      workingArrangementScore,
    },
    strongestMatchingSkills: matchedSkills.slice(0, 5),
    relevantExperience: [
      '3+ years software engineering & web application development',
      'Enterprise React, TypeScript, and dashboard architecture',
    ],
    relevantProjects: [
      'RAG evaluation pipeline with embeddings & vector search',
      'FastAPI & MLflow containerized AI services',
    ],
    missingOrWeakerRequirements:
      seniorityLevel === 'Senior'
        ? ['Advertised seniority is higher; emphasize concrete production impact']
        : [],
    potentialEligibilityConcerns: [],
    geminiSummary: `Live opportunity in ${raw.city} (${raw.region}) for ${raw.title} at ${raw.company}. Scored via local keyword rubric against ${matchedSkills
      .slice(0, 3)
      .join(', ')}.`,
    recommendedCv: cvInfo.recommendedCv,
    cvRecommendationReason: cvInfo.reason,
    threeRequirementsToEmphasize: [
      'Production React.js, TypeScript, and modern UI engineering experience',
      'Practical LLM API, RAG pipeline, and Python/FastAPI integration',
      'Master in Computer Science & Data Science + bilingual delivery',
    ],
    directApplicationUrl: raw.jobUrl,
    sourceUrl: raw.jobUrl,
    listingStatus: 'New',
    userStatus: 'inbox',
    scoredBy: 'heuristic',
  };
}

/**
 * Evaluates a raw discovered job using Google Gemini and the configured Master Prompt.
 * Falls back gracefully to the deterministic 100-pt rubric if API key is missing or rate-limited.
 */
export async function evaluateDiscoveredJobWithGemini(
  raw: RawDiscoveredJob,
  apiKey?: string,
  masterPrompt?: string
): Promise<EvaluatedJob> {
  const effectiveKey =
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY;

  if (!effectiveKey) {
    return evaluateJobHeuristicFallback(raw);
  }

  const systemPrompt = masterPrompt || DEFAULT_GENERIC_MASTER_PROMPT;

  try {
    const evaluationPrompt = `
Evaluate this verified job listing in France strictly according to the MASTER PROMPT.

Job Title: ${raw.title}
Company: ${raw.company}
Location: ${raw.location} (City: ${raw.city}, Region: ${raw.region})
Published: ${raw.postedAgo} (${raw.postedDate})
Employment Type: ${raw.employmentType}
Seniority Hint: ${raw.seniorityLevel}
Direct Application / Source URL: ${raw.jobUrl}

Job Description:
"""
${raw.descriptionText}
"""

IMPORTANT RULES FOR "recommendedCv":
- You are evaluating job listings located in France. In the French tech market, technical titles (e.g., "Senior Frontend Software Engineer ReactJS - Paris - H/F") and framework names are written in English even for 100% French domestic employers.
- DO NOT recommend "CV_EN.pdf" solely because the job title or technical stack contains English words.
- If the job description text is written in French, or contains French statutory markers ("H/F", "F/H", "CDI", "CDD"), or is at a French company communicating in French, you MUST set "recommendedCv": "CV_FR.pdf".
- Recommend "CV_EN.pdf" ONLY if the entire job description text and requirements are written in English prose for an international English-speaking engineering team.

Return ONLY a valid JSON object with these exact keys:
{
  "exactJobTitle": string,
  "companyName": string,
  "city": string,
  "region": string,
  "employmentType": "CDI" | "CDD" | "Full-time" | "Part-time" | "Contract",
  "seniorityLevel": "Junior" | "Mid-level" | "Senior" | "Lead",
  "workingArrangement": "Remote" | "Hybrid" | "On-site",
  "salary": string,
  "requiredLanguages": string[],
  "overallScore": number (0 to 100),
  "matchCategory": "Excellent match" | "Strong match" | "Possible match" | "Low priority",
  "jobCategory": "AI Engineering" | "React / Frontend" | "Combined AI + Software Engineering" | "Related Opportunities",
  "scoreBreakdown": {
    "technicalSkillsScore": number (out of 35),
    "experienceAlignmentScore": number (out of 25),
    "seniorityFitScore": number (out of 15),
    "relevanceScore": number (out of 15),
    "workingArrangementScore": number (out of 10)
  },
  "strongestMatchingSkills": string[],
  "relevantExperience": string[],
  "relevantProjects": string[],
  "missingOrWeakerRequirements": string[],
  "potentialEligibilityConcerns": string[],
  "geminiSummary": string (2-3 sentences analyzing why this role fits the candidate's profile, stack, and experience),
  "recommendedCv": "CV_EN.pdf" | "CV_FR.pdf",
  "cvRecommendationReason": string,
  "threeRequirementsToEmphasize": [string, string, string]
}
`;

    // Only active, production Gemini Flash models (eliminates 404 errors)
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    let rawJson = '';
    for (const modelName of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) {
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const textPart =
          [...parts].reverse().find((p: any) => !p.thought && typeof p.text === 'string') ||
          parts[0];
        const candidateText = textPart?.text;
        if (candidateText) {
          rawJson = candidateText;
          break;
        }
      } else if (res.status === 429) {
        // Paced backoff on rate-limit
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!rawJson) {
      return evaluateJobHeuristicFallback(raw);
    }

    const cleanedJson = rawJson
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const fallback = evaluateJobHeuristicFallback(raw);

    // CV Recommendation: if heuristic statutory check verified French context, enforce CV_FR.pdf
    const finalCv =
      fallback.recommendedCv === 'CV_FR.pdf'
        ? 'CV_FR.pdf'
        : parsed.recommendedCv === 'CV_FR.pdf'
        ? 'CV_FR.pdf'
        : 'CV_EN.pdf';
    const finalCvReason =
      finalCv === 'CV_FR.pdf' && parsed.recommendedCv !== 'CV_FR.pdf'
        ? fallback.cvRecommendationReason
        : parsed.cvRecommendationReason || fallback.cvRecommendationReason;

    return {
      ...fallback,
      id: raw.externalId,
      exactJobTitle: parsed.exactJobTitle || raw.title,
      companyName: parsed.companyName || raw.company,
      city: parsed.city || raw.city,
      region: parsed.region || raw.region,
      country: 'France',
      employmentType: parsed.employmentType || fallback.employmentType,
      seniorityLevel: parsed.seniorityLevel || fallback.seniorityLevel,
      publicationDate: raw.postedAgo || parsed.publicationDate || 'Recent',
      workingArrangement: parsed.workingArrangement || raw.workingArrangement,
      remoteRestrictions: parsed.remoteRestrictions || fallback.remoteRestrictions,
      salary: parsed.salary || 'Not disclosed',
      requiredLanguages: parsed.requiredLanguages || fallback.requiredLanguages,
      workAuthNotes: parsed.workAuthNotes || fallback.workAuthNotes,
      overallScore:
        typeof parsed.overallScore === 'number' ? parsed.overallScore : fallback.overallScore,
      matchCategory: parsed.matchCategory || fallback.matchCategory,
      jobCategory: parsed.jobCategory || fallback.jobCategory,
      scoreBreakdown: parsed.scoreBreakdown || fallback.scoreBreakdown,
      strongestMatchingSkills:
        Array.isArray(parsed.strongestMatchingSkills) && parsed.strongestMatchingSkills.length > 0
          ? parsed.strongestMatchingSkills
          : fallback.strongestMatchingSkills,
      relevantExperience:
        Array.isArray(parsed.relevantExperience) && parsed.relevantExperience.length > 0
          ? parsed.relevantExperience
          : fallback.relevantExperience,
      relevantProjects:
        Array.isArray(parsed.relevantProjects) && parsed.relevantProjects.length > 0
          ? parsed.relevantProjects
          : fallback.relevantProjects,
      missingOrWeakerRequirements: Array.isArray(parsed.missingOrWeakerRequirements)
        ? parsed.missingOrWeakerRequirements
        : [],
      potentialEligibilityConcerns: Array.isArray(parsed.potentialEligibilityConcerns)
        ? parsed.potentialEligibilityConcerns
        : [],
      geminiSummary: parsed.geminiSummary || fallback.geminiSummary,
      recommendedCv: finalCv,
      cvRecommendationReason: finalCvReason,
      threeRequirementsToEmphasize:
        Array.isArray(parsed.threeRequirementsToEmphasize) &&
        parsed.threeRequirementsToEmphasize.length > 0
          ? parsed.threeRequirementsToEmphasize
          : fallback.threeRequirementsToEmphasize,
      directApplicationUrl: raw.jobUrl,
      sourceUrl: raw.jobUrl,
      listingStatus: 'New',
      userStatus: 'inbox',
      scoredBy: 'gemini',
    };
  } catch (err) {
    console.warn('Gemini evaluation fallback triggered for job:', raw.title, err);
    return evaluateJobHeuristicFallback(raw);
  }
}
