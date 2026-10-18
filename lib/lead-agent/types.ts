export type JobCategory =
  | 'AI Engineering'
  | 'React / Frontend'
  | 'Combined AI + Software Engineering'
  | 'Related Opportunities';

export type DashboardTab =
  | 'All Jobs'
  | 'AI Engineering'
  | 'React / Frontend'
  | 'Combined AI + Software Engineering'
  | 'Related Opportunities'
  | 'Saved Jobs'
  | 'Applied Jobs'
  | 'Archived or Rejected Jobs';

export type MatchCategory =
  | 'Excellent match'
  | 'Strong match'
  | 'Possible match'
  | 'Low priority';

export type WorkingArrangement = 'Remote' | 'Hybrid' | 'On-site';

export interface ScoreBreakdown {
  technicalSkillsScore: number; // 35
  experienceAlignmentScore: number; // 25
  seniorityFitScore: number; // 15
  relevanceScore: number; // 15
  workingArrangementScore: number; // 10
}

export interface EvaluatedJob {
  id: string;
  exactJobTitle: string;
  companyName: string;
  city: string;
  region: string;
  country: 'France';
  employmentType: 'CDI' | 'CDD' | 'Full-time' | 'Part-time' | 'Contract';
  seniorityLevel: 'Junior' | 'Mid-level' | 'Senior' | 'Lead';
  publicationDate: string;
  workingArrangement: WorkingArrangement;
  remoteRestrictions: string;
  salary: string; // 'Not disclosed' or currency string (0 impact on score)
  requiredLanguages: string[];
  workAuthNotes: string;
  
  // Gemini Match Evaluation (100 pt formula)
  overallScore: number;
  matchCategory: MatchCategory;
  jobCategory: JobCategory;
  scoreBreakdown: ScoreBreakdown;
  strongestMatchingSkills: string[];
  relevantExperience: string[];
  relevantProjects: string[];
  missingOrWeakerRequirements: string[];
  potentialEligibilityConcerns: string[];
  geminiSummary: string;

  // CV Recommendation
  recommendedCv: 'CV_EN.pdf' | 'CV_FR.pdf';
  cvRecommendationReason: string;
  threeRequirementsToEmphasize: string[];

  // URLs & Status
  directApplicationUrl: string;
  sourceUrl: string;
  listingStatus: 'New' | 'Previously Seen' | 'Updated' | 'Unverified';
  userStatus: 'inbox' | 'saved' | 'applied' | 'archived';
  scoredBy?: 'gemini' | 'heuristic';
  appliedAt?: string;
  notes?: string;
}
