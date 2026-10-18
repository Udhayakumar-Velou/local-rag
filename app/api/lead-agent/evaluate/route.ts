import { NextRequest, NextResponse } from 'next/server';
import { loadLeadAgentSettings } from '@/lib/lead-agent/settings';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobTitle, company, location, jobText, apiKey: clientApiKey } = body;

    const settings = await loadLeadAgentSettings();
    const apiKey =
      clientApiKey ||
      settings.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY;

    if (!jobText && !jobTitle) {
      return NextResponse.json(
        { error: 'Job description or title is required for evaluation.' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Google Gemini API Key is required. Save it once in Lead Agent Profile & Settings to use it everywhere.',
        },
        { status: 401 }
      );
    }

    const evaluationPrompt = `
You are evaluating this job posting strictly following the rules of the MASTER PROMPT.
Analyze the job description against the candidate's professional profile.

Job Title: ${jobTitle || 'Not specified'}
Company: ${company || 'Not specified'}
Location provided: ${location || 'France'}
Job Posting Text:
"""
${jobText || ''}
"""

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
  "geminiSummary": string,
  "recommendedCv": "CV_EN.pdf" | "CV_FR.pdf",
  "cvRecommendationReason": string,
  "threeRequirementsToEmphasize": [string, string, string]
}
`;

    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ];

    let rawJson = '';
    let lastErrorText = '';
    let lastStatus = 500;

    for (const modelName of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: settings.masterPrompt }] },
          contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const textPart =
          [...parts].reverse().find((p: any) => !p.thought && typeof p.text === 'string') ||
          parts[0];
        if (textPart?.text) {
          rawJson = textPart.text;
          break;
        }
      } else {
        lastStatus = response.status;
        lastErrorText = await response.text();
      }
    }

    if (!rawJson) {
      return NextResponse.json(
        { error: `Gemini API error: ${lastErrorText}` },
        { status: lastStatus }
      );
    }

    const cleanedJson = rawJson
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);
    return NextResponse.json({ ...parsed, scoredBy: 'gemini' });
  } catch (error: any) {
    console.error('Error evaluating job with Gemini:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to evaluate job posting with Gemini.' },
      { status: 500 }
    );
  }
}
