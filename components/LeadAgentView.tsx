'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EvaluatedJob, DashboardTab } from '@/lib/lead-agent/types';
import { DEFAULT_GENERIC_MASTER_PROMPT } from '@/lib/lead-agent/master-prompt';

interface LeadAgentViewProps {
  onBackToChat?: () => void;
  onOpenSidebar?: () => void;
}

const TAB_DISPLAY_LABELS: Record<DashboardTab, string> = {
  'All Jobs': 'All Jobs',
  'Combined AI + Software Engineering': 'AI + Full-Stack',
  'AI Engineering': 'AI Engineering',
  'React / Frontend': 'React / Frontend',
  'Related Opportunities': 'Related',
  'Saved Jobs': '★ Saved',
  'Applied Jobs': '✓ Applied',
  'Archived or Rejected Jobs': 'Archived',
};

export function LeadAgentView({ onBackToChat, onOpenSidebar }: LeadAgentViewProps) {
  // Tabs matching Section 10 of Master Prompt + All Jobs overview tab
  const [activeTab, setActiveTab] = useState<DashboardTab>('All Jobs');
  const [jobs, setJobs] = useState<EvaluatedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [isScanningFrance, setIsScanningFrance] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [scanBanner, setScanBanner] = useState<string | null>(null);

  // Collapsible drawer for advanced filters & live LinkedIn quick search
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Quick Search State (1-click live search across France without re-entering API key)
  const [quickSearchInput, setQuickSearchInput] = useState('');

  // Private Settings State (Loaded from Supabase Cloud / gitignored store — zero personal info in Git code)
  const [candidateName, setCandidateName] = useState('');
  const [candidateHeadline, setCandidateHeadline] = useState('');
  const [cvEnName, setCvEnName] = useState('CV_EN.pdf');
  const [cvFrName, setCvFrName] = useState('CV_FR.pdf');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [masterPrompt, setMasterPrompt] = useState(DEFAULT_GENERIC_MASTER_PROMPT);
  const [searchQueriesText, setSearchQueriesText] = useState(
    'AI Engineer, LLM RAG Python, React TypeScript, Frontend Engineer React, Full Stack React Python'
  );
  const [scanFrequency, setScanFrequency] = useState<'6h' | '12h' | '24h'>('6h');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  // Local UI Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('All France');
  const [arrangementFilter, setArrangementFilter] = useState<'All' | 'Remote' | 'Hybrid' | 'On-site'>('All');
  const [scoreFilter, setScoreFilter] = useState<'All' | '85+' | '70-84' | '55-69'>('All');
  const [languageFilter, setLanguageFilter] = useState<'All' | 'EN' | 'FR'>('All');
  const [freshnessFilter, setFreshnessFilter] = useState<'All' | 'New' | 'Previously Seen'>('All');
  const [sortOrder, setSortOrder] = useState<'newest_posted' | 'new_scraped_first' | 'highest_score'>('newest_posted');

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'prompt' | 'api'>('profile');
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState<EvaluatedJob | null>(null);

  // Custom Job Evaluation
  const [evalJobTitle, setEvalJobTitle] = useState('');
  const [evalCompany, setEvalCompany] = useState('');
  const [evalLocation, setEvalLocation] = useState('France');
  const [evalJobText, setEvalJobText] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState('');

  // Load private settings from server (Supabase Cloud / gitignored store)
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/lead-agent/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.candidateName) setCandidateName(data.candidateName);
          if (data.candidateHeadline) setCandidateHeadline(data.candidateHeadline);
          if (data.cvEnName) setCvEnName(data.cvEnName);
          if (data.cvFrName) setCvFrName(data.cvFrName);
          if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey);
          if (data.masterPrompt) setMasterPrompt(data.masterPrompt);
          if (data.scanFrequency) setScanFrequency(data.scanFrequency);
          if (Array.isArray(data.searchQueries) && data.searchQueries.length > 0) {
            setSearchQueriesText(data.searchQueries.join(', '));
          }
        }
      } catch {
        // Ignore
      }
    }
    fetchSettings();
  }, []);

  const handleSaveCloudSettings = async () => {
    setSavingSettings(true);
    setSettingsSavedMsg('');
    try {
      const parsedQueries = searchQueriesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/lead-agent/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateHeadline,
          cvEnName,
          cvFrName,
          geminiApiKey,
          scanFrequency,
          searchQueries: parsedQueries,
          masterPrompt,
        }),
      });
      if (res.ok) {
        setSettingsSavedMsg('✓ Saved to Cloud & Private Store');
        setTimeout(() => setSettingsSavedMsg(''), 3000);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerLiveScan = useCallback(async (quickQueryOverride?: string) => {
    setIsScanningFrance(true);
    setScanBanner(
      quickQueryOverride
        ? `Quick searching France for "${quickQueryOverride}"...`
        : 'Scanning LinkedIn France across your target categories...'
    );
    try {
      const res = await fetch('/api/lead-agent/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickQuery: quickQueryOverride || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.allJobs)) {
        setJobs(data.allJobs);
        setLastScanAt(data.lastScanAt || new Date().toISOString());
        setScanBanner(data.summary || `Scan complete: ${data.allJobs.length} total verified jobs.`);
      } else {
        setScanBanner(data.error || 'Could not complete live scan.');
      }
    } catch (err: any) {
      setScanBanner(err?.message || 'Network error while scanning France jobs.');
    } finally {
      setIsScanningFrance(false);
    }
  }, []);

  // Load persisted jobs on mount; if none stored yet, automatically trigger first live France scan
  useEffect(() => {
    let mounted = true;
    async function initJobs() {
      setLoadingJobs(true);
      try {
        const res = await fetch('/api/lead-agent/jobs');
        const data = await res.json();
        if (!mounted) return;

        if (res.ok && Array.isArray(data.jobs) && data.jobs.length > 0) {
          setJobs(data.jobs);
          setLastScanAt(data.lastScanAt || null);
          setScanBanner(data.lastScanSummary || null);
          setLoadingJobs(false);
        } else {
          setLoadingJobs(false);
          handleTriggerLiveScan();
        }
      } catch {
        if (mounted) setLoadingJobs(false);
      }
    }
    initJobs();
    return () => {
      mounted = false;
    };
  }, [handleTriggerLiveScan]);

  const handleRunGeminiEvaluation = async () => {
    if (!evalJobText.trim() && !evalJobTitle.trim()) {
      setEvalError('Please provide a job title or job description text.');
      return;
    }
    setIsEvaluating(true);
    setEvalError('');

    try {
      const res = await fetch('/api/lead-agent/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: evalJobTitle,
          company: evalCompany,
          location: evalLocation,
          jobText: evalJobText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to evaluate job with Gemini');
      }

      const newEvaluatedJob: EvaluatedJob = {
        id: `job-eval-${Date.now()}`,
        exactJobTitle: data.exactJobTitle || evalJobTitle || 'Evaluated Position',
        companyName: data.companyName || evalCompany || 'Company in France',
        city: data.city || 'Paris',
        region: data.region || 'Île-de-France',
        country: 'France',
        employmentType: data.employmentType || 'CDI',
        seniorityLevel: data.seniorityLevel || 'Mid-level',
        publicationDate: data.publicationDate || 'Today',
        workingArrangement: data.workingArrangement || 'Hybrid',
        remoteRestrictions: data.remoteRestrictions || 'Permits work from France',
        salary: data.salary || 'Not disclosed',
        requiredLanguages: data.requiredLanguages || ['French', 'English'],
        workAuthNotes: data.workAuthNotes || 'France authorization',
        overallScore: data.overallScore ?? 85,
        matchCategory: data.matchCategory || 'Strong match',
        jobCategory: data.jobCategory || 'Combined AI + Software Engineering',
        scoreBreakdown: data.scoreBreakdown || {
          technicalSkillsScore: 30,
          experienceAlignmentScore: 22,
          seniorityFitScore: 13,
          relevanceScore: 14,
          workingArrangementScore: 8,
        },
        strongestMatchingSkills: data.strongestMatchingSkills || ['React', 'TypeScript', 'Python'],
        relevantExperience: data.relevantExperience || ['Web development with React'],
        relevantProjects: data.relevantProjects || ['RAG pipeline evaluation'],
        missingOrWeakerRequirements: data.missingOrWeakerRequirements || [],
        potentialEligibilityConcerns: data.potentialEligibilityConcerns || [],
        geminiSummary: data.geminiSummary || 'Evaluated using Master Prompt criteria.',
        recommendedCv: data.recommendedCv || 'CV_FR.pdf',
        cvRecommendationReason: data.cvRecommendationReason || 'Evaluated based on posting language.',
        threeRequirementsToEmphasize: data.threeRequirementsToEmphasize || [
          'Production React experience',
          'AI / LLM API integration',
          'Proven problem solving',
        ],
        directApplicationUrl: data.directApplicationUrl || '#',
        sourceUrl: data.sourceUrl || '#',
        listingStatus: 'New',
        userStatus: 'inbox',
        scoredBy: data.scoredBy || 'gemini',
      };

      const saveRes = await fetch('/api/lead-agent/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: newEvaluatedJob }),
      });
      const saveData = await saveRes.json();
      if (saveRes.ok && Array.isArray(saveData.allJobs)) {
        setJobs(saveData.allJobs);
      } else {
        setJobs((prev) => [newEvaluatedJob, ...prev]);
      }

      setShowEvaluateModal(false);
      setEvalJobTitle('');
      setEvalCompany('');
      setEvalJobText('');
      setSelectedJobDetails(newEvaluatedJob);
    } catch (err: any) {
      setEvalError(err?.message || 'Error occurred during Gemini evaluation.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const updateJobStatus = async (id: string, newStatus: EvaluatedJob['userStatus']) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, userStatus: newStatus } : j))
    );
    try {
      await fetch('/api/lead-agent/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id, userStatus: newStatus }),
      });
    } catch {
      // Optimistic UI already updated
    }
  };

  // Tab membership rule:
  // - 'Applied Jobs' holds jobs marked as applied
  // - 'Archived or Rejected Jobs' holds archived jobs
  // - 'Saved Jobs' holds saved jobs
  // - 'All Jobs' and the 4 Category tabs ONLY show active (non-applied, non-archived) jobs
  const matchesTab = (job: EvaluatedJob, tab: DashboardTab): boolean => {
    if (tab === 'Saved Jobs') return job.userStatus === 'saved';
    if (tab === 'Applied Jobs') return job.userStatus === 'applied';
    if (tab === 'Archived or Rejected Jobs') return job.userStatus === 'archived';
    if (job.userStatus === 'applied' || job.userStatus === 'archived') return false;
    if (tab === 'All Jobs') return true;
    return job.jobCategory === tab;
  };

  // Base filters (Region, Work Arrangement, Score, Search Query) independent of Tab & Language
  const matchesBaseFilters = (job: EvaluatedJob): boolean => {
    if (arrangementFilter !== 'All' && job.workingArrangement !== arrangementFilter) {
      return false;
    }

    if (regionFilter === 'Outside Paris') {
      const isParis =
        job.region.toLowerCase().includes('île-de-france') ||
        job.city.toLowerCase().includes('paris');
      if (isParis) return false;
    } else if (regionFilter !== 'All France') {
      const matchRegion =
        job.region.toLowerCase().includes(regionFilter.toLowerCase()) ||
        job.city.toLowerCase().includes(regionFilter.toLowerCase());
      if (!matchRegion) return false;
    }

    if (scoreFilter === '85+' && job.overallScore < 85) return false;
    if (scoreFilter === '70-84' && (job.overallScore < 70 || job.overallScore >= 85)) return false;
    if (scoreFilter === '55-69' && (job.overallScore < 55 || job.overallScore >= 70)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText =
        job.exactJobTitle.toLowerCase().includes(q) ||
        job.companyName.toLowerCase().includes(q) ||
        job.strongestMatchingSkills.some((s) => s.toLowerCase().includes(q)) ||
        job.city.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    return true;
  };

  const matchesLanguageFilter = (job: EvaluatedJob, lang: 'All' | 'EN' | 'FR'): boolean => {
    if (lang === 'EN') return job.recommendedCv === 'CV_EN.pdf';
    if (lang === 'FR') return job.recommendedCv === 'CV_FR.pdf';
    return true;
  };

  const matchesFreshnessFilter = (
    job: EvaluatedJob,
    freshness: 'All' | 'New' | 'Previously Seen'
  ): boolean => {
    if (freshness === 'New') return job.listingStatus === 'New';
    if (freshness === 'Previously Seen') return job.listingStatus !== 'New';
    return true;
  };

  // Converts relative posted string ("52 minutes ago", "1 hour ago", "2 days ago") to minutes
  const parsePostedAgeMinutes = (publicationDate: string): number => {
    const text = (publicationDate || '').toLowerCase().trim();
    if (!text || /just now|instant|today|aujourd'hui/i.test(text)) return 5;
    const minMatch = text.match(/(\d+)\s*(minute|minutes|min|mins)/i);
    if (minMatch) return parseInt(minMatch[1], 10);
    const hourMatch = text.match(/(\d+)\s*(hour|hours|hr|hrs|heure|heures)/i);
    if (hourMatch) return parseInt(hourMatch[1], 10) * 60;
    const dayMatch = text.match(/(\d+)\s*(day|days|jour|jours)/i);
    if (dayMatch) return parseInt(dayMatch[1], 10) * 1440;
    return 2880;
  };

  const filteredJobs = jobs
    .filter(
      (job) =>
        matchesTab(job, activeTab) &&
        matchesBaseFilters(job) &&
        matchesLanguageFilter(job, languageFilter) &&
        matchesFreshnessFilter(job, freshnessFilter)
    )
    .sort((a, b) => {
      if (sortOrder === 'new_scraped_first') {
        const aIsNew = a.listingStatus === 'New' ? 1 : 0;
        const bIsNew = b.listingStatus === 'New' ? 1 : 0;
        if (aIsNew !== bIsNew) return bIsNew - aIsNew;
      }

      if (sortOrder === 'highest_score') {
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      }

      // Default ('newest_posted'): sort strictly from lowest hour/minute (newest) to highest (oldest)
      const aAge = parsePostedAgeMinutes(a.publicationDate);
      const bAge = parsePostedAgeMinutes(b.publicationDate);
      if (aAge !== bAge) return aAge - bAge;

      // Tie-breaker: Newly scraped first, then English CV, then highest score
      const aIsNew = a.listingStatus === 'New' ? 1 : 0;
      const bIsNew = b.listingStatus === 'New' ? 1 : 0;
      if (aIsNew !== bIsNew) return bIsNew - aIsNew;

      const aIsEn = a.recommendedCv === 'CV_EN.pdf' ? 1 : 0;
      const bIsEn = b.recommendedCv === 'CV_EN.pdf' ? 1 : 0;
      if (aIsEn !== bIsEn) return bIsEn - aIsEn;

      return b.overallScore - a.overallScore;
    });

  // Language & Freshness counts dynamically reflect the currently selected tab + active filters
  const currentTabJobs = jobs.filter(
    (j) =>
      matchesTab(j, activeTab) &&
      matchesBaseFilters(j) &&
      matchesFreshnessFilter(j, freshnessFilter)
  );
  const allLangJobsCount = currentTabJobs.length;
  const enJobsCount = currentTabJobs.filter((j) => j.recommendedCv === 'CV_EN.pdf').length;
  const frJobsCount = currentTabJobs.filter((j) => j.recommendedCv === 'CV_FR.pdf').length;

  const currentTabLangJobs = jobs.filter(
    (j) =>
      matchesTab(j, activeTab) &&
      matchesBaseFilters(j) &&
      matchesLanguageFilter(j, languageFilter)
  );
  const newScrapedCount = currentTabLangJobs.filter((j) => j.listingStatus === 'New').length;
  const oldScrapedCount = currentTabLangJobs.filter((j) => j.listingStatus !== 'New').length;

  const activeAdvancedFilterCount =
    (arrangementFilter !== 'All' ? 1 : 0) +
    (scoreFilter !== 'All' ? 1 : 0) +
    (freshnessFilter === 'Previously Seen' ? 1 : 0) +
    (sortOrder !== 'newest_posted' ? 1 : 0);

  const resetAllFilters = () => {
    setSearchQuery('');
    setRegionFilter('All France');
    setArrangementFilter('All');
    setScoreFilter('All');
    setLanguageFilter('All');
    setFreshnessFilter('All');
    setSortOrder('newest_posted');
  };

  const getScoreColorBadge = (score: number) => {
    if (score >= 85) return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (score >= 70) return 'bg-blue-50 text-blue-800 border-blue-300';
    if (score >= 55) return 'bg-amber-50 text-amber-800 border-amber-300';
    return 'bg-stone-100 text-stone-700 border-stone-200';
  };

  return (
    <div className="flex h-full flex-col bg-[#fdfcf9] text-stone-800">
      {/* Row 1: Clean, Responsive Top Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[#ded9cf] bg-[#fdfcf9] px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#ded9cf] bg-white text-stone-600 hover:bg-[#eeece5] md:hidden"
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h12" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-sm sm:text-base font-bold tracking-tight text-stone-900">
                Lead Agent · France
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {geminiApiKey ? 'Gemini AI' : 'Active'}
              </span>
            </div>
            <p className="truncate text-[11px] text-stone-500">
              {candidateName ? `${candidateName} • ` : ''}All France
              {lastScanAt && (
                <span className="ml-1.5 text-stone-400">
                  • Scanned {new Date(lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onBackToChat && (
            <button
              type="button"
              onClick={onBackToChat}
              className="flex md:hidden items-center gap-1 rounded-xl border border-[#ded9cf] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#eeece5]"
            >
              <span>💬 Chat</span>
            </button>
          )}

          <button
            type="button"
            disabled={isScanningFrance}
            onClick={() => handleTriggerLiveScan()}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-50 transition active:scale-95"
          >
            {isScanningFrance ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Scan France</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowEvaluateModal(true)}
            className="flex items-center gap-1 rounded-xl bg-stone-900 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition active:scale-95"
          >
            <span>+ Evaluate</span>
            <span className="hidden sm:inline">Job</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileModalTab('profile');
              setShowProfileModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#ded9cf] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-[#eeece5] transition"
            title="Manage Profile, Master Prompt & Gemini API Key"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-800 text-[9px] font-bold text-white">
              {candidateName ? candidateName.charAt(0).toUpperCase() : '👤'}
            </span>
            <span className="hidden sm:inline">Profile</span>
          </button>
        </div>
      </header>

      {/* Live Scan Status Banner */}
      {scanBanner && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 bg-amber-50/80 px-4 sm:px-6 py-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 shrink-0 rounded-full ${isScanningFrance ? 'bg-amber-600 animate-ping' : 'bg-emerald-600'}`} />
            <span className="truncate">{scanBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanBanner(null)}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-amber-700 hover:bg-amber-100 hover:text-amber-950"
          >
            ✕
          </button>
        </div>
      )}

      {/* Row 2: Compact Category Tabs + Streamlined Primary Toolbar */}
      <div className="border-b border-[#ded9cf] bg-white px-4 sm:px-6 pt-2 pb-2.5 space-y-2.5">
        {/* Horizontal Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {(
            [
              'All Jobs',
              'Combined AI + Software Engineering',
              'AI Engineering',
              'React / Frontend',
              'Related Opportunities',
              'Saved Jobs',
              'Applied Jobs',
              'Archived or Rejected Jobs',
            ] as DashboardTab[]
          ).map((tab) => {
            const isActive = activeTab === tab;
            const count = jobs.filter(
              (j) =>
                matchesTab(j, tab) &&
                matchesBaseFilters(j) &&
                matchesLanguageFilter(j, languageFilter) &&
                matchesFreshnessFilter(j, freshnessFilter)
            ).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                    : 'bg-[#f4f2ec] text-stone-600 hover:bg-[#e8e4db] hover:text-stone-900'
                }`}
              >
                <span>{TAB_DISPLAY_LABELS[tab]}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-stone-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single-Row Primary Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Filter Input + Quick Toggles */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <input
                type="text"
                placeholder="Filter by title, company, city, skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#ded9cf] bg-[#fdfcf9] pl-3 pr-7 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1.5 text-xs text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 1-Click Newly Scraped Filter Pill */}
            <button
              type="button"
              onClick={() => setFreshnessFilter(freshnessFilter === 'New' ? 'All' : 'New')}
              className={`shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition border ${
                freshnessFilter === 'New'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                  : newScrapedCount > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-[#f4f2ec] text-stone-600 border-transparent hover:bg-[#e8e4db]'
              }`}
              title="Toggle showing only newly scraped jobs from the latest scan"
            >
              🆕 New ({newScrapedCount})
            </button>

            {/* Compact Language Segmented Control */}
            <div className="inline-flex items-center rounded-xl bg-[#f4f2ec] p-0.5">
              {(
                [
                  { id: 'All', label: `All (${allLangJobsCount})` },
                  { id: 'EN', label: `🇬🇧 EN (${enJobsCount})` },
                  { id: 'FR', label: `🇫🇷 FR (${frJobsCount})` },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguageFilter(lang.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    languageFilter === lang.id
                      ? 'bg-white text-stone-900 font-semibold shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Region Dropdown + Collapsible Filters & Quick Search Button */}
          <div className="flex items-center gap-2">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="max-w-[180px] sm:max-w-none rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:outline-none"
            >
              <option value="All France">🇫🇷 All France</option>
              <option value="Outside Paris">🗺️ Outside Paris</option>
              <option value="Paris">Paris & Île-de-France</option>
              <option value="Auvergne-Rhône-Alpes">Lyon / Grenoble (ARA)</option>
              <option value="Pays de la Loire">Nantes / Laval</option>
              <option value="Nouvelle-Aquitaine">Bordeaux</option>
              <option value="Occitanie">Toulouse / Montpellier</option>
              <option value="Hauts-de-France">Lille</option>
              <option value="Bretagne">Rennes / Bretagne</option>
              <option value="Provence-Alpes-Côte d'Azur">Nice / Sophia / Marseille</option>
              <option value="Grand Est">Strasbourg</option>
            </select>

            <button
              type="button"
              onClick={() => setShowFiltersDrawer((prev) => !prev)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                showFiltersDrawer || activeAdvancedFilterCount > 0
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-[#ded9cf] bg-[#fdfcf9] text-stone-700 hover:bg-[#eeece5]'
              }`}
            >
              <span>🎛️ Filters & Search</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-bold text-stone-950">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Drawer: Live LinkedIn Quick Search + Sort / Work / Score / Status */}
        {showFiltersDrawer && (
          <div className="mt-2 rounded-2xl border border-[#ded9cf] bg-[#f7f5f0] p-3.5 space-y-3 animate-in fade-in duration-150">
            {/* Row A: Live LinkedIn France Search + 1-Click Tags */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-b border-[#ded9cf]/80 pb-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (quickSearchInput.trim()) {
                    handleTriggerLiveScan(quickSearchInput.trim());
                  }
                }}
                className="flex flex-1 items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Live LinkedIn France search (e.g. 'AI Engineer Paris', 'React Next.js')..."
                  value={quickSearchInput}
                  onChange={(e) => setQuickSearchInput(e.target.value)}
                  className="w-full rounded-xl border border-[#ded9cf] bg-white px-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500"
                />
                <button
                  type="submit"
                  disabled={isScanningFrance || !quickSearchInput.trim()}
                  className="shrink-0 rounded-xl bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40 transition"
                >
                  Search LinkedIn
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-stone-500">1-Click Live Scan:</span>
                {[
                  'AI Engineer',
                  'React TypeScript',
                  'LLM RAG Python',
                  'Next.js Frontend',
                  'Full Stack React',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={isScanningFrance}
                    onClick={() => {
                      setQuickSearchInput(tag);
                      handleTriggerLiveScan(tag);
                    }}
                    className="rounded-lg border border-[#ded9cf] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-900 hover:text-white transition disabled:opacity-40"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Row B: Advanced Filters (Sort, Batch Status, Work Mode, Score) */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Sort Order */}
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500 font-medium">Sort:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(
                        e.target.value as 'newest_posted' | 'new_scraped_first' | 'highest_score'
                      )
                    }
                    className="rounded-xl border border-[#ded9cf] bg-white px-2.5 py-1 text-xs font-medium text-stone-800 focus:outline-none"
                  >
                    <option value="newest_posted">🕒 Lowest Hour First (Newest)</option>
                    <option value="new_scraped_first">🆕 Newly Scraped Batch First</option>
                    <option value="highest_score">🏆 Highest Match Score First</option>
                  </select>
                </div>

                {/* Batch Status */}
                <div className="flex items-center gap-1">
                  <span className="text-stone-500 font-medium">Batch:</span>
                  {(
                    [
                      { id: 'All', label: `All (${newScrapedCount + oldScrapedCount})` },
                      { id: 'New', label: `🆕 New (${newScrapedCount})` },
                      { id: 'Previously Seen', label: `Seen (${oldScrapedCount})` },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setFreshnessFilter(st.id)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                        freshnessFilter === st.id
                          ? 'bg-stone-900 text-white'
                          : 'bg-white text-stone-600 border border-[#ded9cf] hover:bg-[#eeece5]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Work Mode */}
                <div className="flex items-center gap-1">
                  <span className="text-stone-500 font-medium">Work:</span>
                  {(['All', 'Remote', 'Hybrid', 'On-site'] as const).map((arr) => (
                    <button
                      key={arr}
                      type="button"
                      onClick={() => setArrangementFilter(arr)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                        arrangementFilter === arr
                          ? 'bg-stone-900 text-white'
                          : 'bg-white text-stone-600 border border-[#ded9cf] hover:bg-[#eeece5]'
                      }`}
                    >
                      {arr}
                    </button>
                  ))}
                </div>

                {/* Score */}
                <div className="flex items-center gap-1">
                  <span className="text-stone-500 font-medium">Score:</span>
                  {(['All', '85+', '70-84', '55-69'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setScoreFilter(sc)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                        scoreFilter === sc
                          ? 'bg-stone-900 text-white'
                          : 'bg-white text-stone-600 border border-[#ded9cf] hover:bg-[#eeece5]'
                      }`}
                    >
                      {sc === 'All' ? 'All' : `${sc}`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-medium text-stone-500 hover:text-stone-900 underline"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Jobs Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3">
        {loadingJobs || (isScanningFrance && jobs.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-4">
            <div className="h-8 w-8 rounded-full border-2 border-stone-800 border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-stone-800">
              Discovering & evaluating live jobs across France...
            </p>
            <p className="text-xs text-stone-500 max-w-md">
              Querying public France job listings for AI Engineering, React/Frontend, and Full-Stack roles, deduplicating, and scoring against your profile.
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2.5 px-4">
            <div className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
              🔍
            </div>
            <p className="text-sm font-semibold text-stone-700">No jobs in this view match your current filters</p>
            <p className="text-xs text-stone-400 max-w-sm">
              Try resetting your filters or switching tabs above to see all available France roles.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-1 rounded-xl border border-[#ded9cf] bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-[#eeece5]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isFrCv = job.recommendedCv === 'CV_FR.pdf';
            const displayCvName = isFrCv ? cvFrName : cvEnName;
            const isNewlyScraped = job.listingStatus === 'New';
            const ageMinutes = parsePostedAgeMinutes(job.publicationDate);
            const isUnder24h = ageMinutes < 1440;

            return (
              <div
                key={job.id}
                className={`group rounded-2xl border bg-white p-4 sm:p-5 shadow-2xs transition hover:shadow-sm space-y-3 ${
                  isNewlyScraped
                    ? 'border-[#ded9cf] border-l-4 border-l-emerald-500 hover:border-[#cfc9be]'
                    : 'border-[#ded9cf] hover:border-[#cfc9be]'
                }`}
              >
                {/* Card Top: Meta pills + Job Title & Company on Left, Score Badge on Right */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Compact Status & Freshness Row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isNewlyScraped ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          🆕 New
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                          Seen
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          isUnder24h
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        🕒 {job.publicationDate}
                      </span>

                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                        {job.workingArrangement}
                      </span>

                      <span className="hidden sm:inline-flex rounded-md bg-amber-50 border border-amber-200/70 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {TAB_DISPLAY_LABELS[job.jobCategory] || job.jobCategory}
                      </span>
                    </div>

                    {/* Title & Company + Location */}
                    <h2 className="text-sm sm:text-base font-bold text-stone-900 leading-snug">
                      {job.exactJobTitle}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-600">
                      <span className="font-semibold text-stone-800">{job.companyName}</span>
                      <span className="text-stone-300">•</span>
                      <span>📍 {job.city}, {job.region}</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-stone-500">{job.employmentType} ({job.seniorityLevel})</span>
                    </div>
                  </div>

                  {/* Right: Match Score Badge */}
                  <button
                    type="button"
                    onClick={() => setSelectedJobDetails(job)}
                    title="Click to inspect full 100-point breakdown & 3 key points to emphasize"
                    className={`shrink-0 flex flex-col items-end rounded-xl border px-2.5 sm:px-3 py-1.5 text-right transition hover:opacity-90 ${getScoreColorBadge(
                      job.overallScore
                    )}`}
                  >
                    <span className="text-xs sm:text-sm font-bold leading-tight">
                      {job.overallScore} / 100
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase">
                      {job.matchCategory}
                    </span>
                  </button>
                </div>

                {/* Card Middle: Clean, Uncluttered AI Evaluation Summary */}
                <div className="rounded-xl border border-stone-200/80 bg-[#fdfcf9] px-3 py-2.5 text-xs leading-relaxed">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-stone-700 text-[11px] flex items-center gap-1">
                      <span className="text-amber-600">✨</span> Why it matches
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        job.scoredBy === 'gemini'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {job.scoredBy === 'gemini' ? '✨ Gemini AI' : '⚙️ Keyword Formula'}
                    </span>
                  </div>
                  <p className="text-stone-700 line-clamp-2 sm:line-clamp-none">{job.geminiSummary}</p>
                </div>

                {/* Card Footer: CV Pill + Top 3 Skills on Left, Responsive Action Buttons on Right */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold border ${
                        isFrCv
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}
                      title={job.cvRecommendationReason}
                    >
                      {isFrCv ? `🇫🇷 ${displayCvName}` : `🇬🇧 ${displayCvName}`}
                    </span>

                    {job.strongestMatchingSkills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons (Mobile-friendly wrap) */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedJobDetails(job)}
                      className="rounded-xl border border-[#ded9cf] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#eeece5]"
                    >
                      Details
                    </button>

                    {job.userStatus !== 'saved' ? (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, 'saved')}
                        className="rounded-xl border border-[#ded9cf] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#eeece5]"
                      >
                        ★ Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, 'inbox')}
                        className="rounded-xl bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 text-xs font-semibold"
                      >
                        ★ Saved
                      </button>
                    )}

                    {job.userStatus !== 'applied' ? (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, 'applied')}
                        className="rounded-xl border border-[#ded9cf] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300"
                      >
                        ✓ Applied
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, 'inbox')}
                        title="Click to move back to Inbox"
                        className="rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-200 transition"
                      >
                        ✓ Applied (Undo)
                      </button>
                    )}

                    {job.userStatus !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, 'archived')}
                        className="rounded-xl border border-[#ded9cf] bg-white px-2 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                        title="Archive or Reject"
                      >
                        ✕
                      </button>
                    )}

                    <a
                      href={job.directApplicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition active:scale-95"
                    >
                      <span>Apply</span>
                      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PROFILE, MASTER PROMPT & API KEY CLOUD SETTINGS MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4">
          <div className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-white shadow-2xl flex flex-col border border-stone-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-4 sm:px-6 py-3.5 bg-[#fdfcf9]">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-stone-900">
                  Profile, Master Prompt & Cloud Settings
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-500">
                  Stored privately in Supabase Cloud & gitignored storage — never committed to Git.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs inside Profile Modal */}
            <div className="flex overflow-x-auto scrollbar-none border-b border-stone-200 bg-[#eeece5]/50 px-4 sm:px-6 pt-2 gap-2">
              {(
                [
                  { id: 'profile', label: '👤 Profile & CVs' },
                  { id: 'prompt', label: '📜 Master Prompt' },
                  { id: 'api', label: '🔑 Gemini Key & Schedule' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setProfileModalTab(t.id)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                    profileModalTab === t.id
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {profileModalTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Candidate Name (Stored in Cloud, not Git)
                      </label>
                      <input
                        type="text"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Professional Headline
                      </label>
                      <input
                        type="text"
                        value={candidateHeadline}
                        onChange={(e) => setCandidateHeadline(e.target.value)}
                        placeholder="e.g. MSc Data Science & CS • AI, React & Full-Stack"
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-1.5">
                      <label className="block text-xs font-semibold text-blue-900">
                        🇫🇷 French CV Filename
                      </label>
                      <input
                        type="text"
                        value={cvFrName}
                        onChange={(e) => setCvFrName(e.target.value)}
                        className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-stone-800"
                      />
                      <p className="text-[11px] text-blue-700">
                        Recommended automatically when advertisement/team is in French.
                      </p>
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-1.5">
                      <label className="block text-xs font-semibold text-purple-900">
                        🇬🇧 English CV Filename
                      </label>
                      <input
                        type="text"
                        value={cvEnName}
                        onChange={(e) => setCvEnName(e.target.value)}
                        className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-stone-800"
                      />
                      <p className="text-[11px] text-purple-700">
                        Recommended automatically for English / international roles in France.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Default Automated France Search Queries (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={searchQueriesText}
                      onChange={(e) => setSearchQueriesText(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-500"
                    />
                  </div>
                </div>
              )}

              {profileModalTab === 'prompt' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label className="text-xs font-semibold text-stone-700">
                      Your Personal Master Prompt (Synced to Supabase Cloud)
                    </label>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      ✓ Used as system instruction for Gemini
                    </span>
                  </div>
                  <textarea
                    rows={14}
                    value={masterPrompt}
                    onChange={(e) => setMasterPrompt(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-[#fdfcf9] p-3.5 font-mono text-xs leading-relaxed text-stone-800 focus:outline-none focus:border-stone-500"
                  />
                </div>
              )}

              {profileModalTab === 'api' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-stone-900">
                        Google Gemini API Key
                      </label>
                      {geminiApiKey ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          ✓ Key Configured
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          Set in .env.local or here
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="Paste your AIzaSy... Gemini key here (or keep in .env.local)"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-500 font-mono"
                    />
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      <strong>How search & evaluation work:</strong> Finding jobs on LinkedIn France uses our public HTTP scraper. Your Gemini API key is used automatically to score each job (0–100) using your Master Prompt.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Scheduled Cloud Discovery Frequency
                    </label>
                    <select
                      value={scanFrequency}
                      onChange={(e) => setScanFrequency(e.target.value as '6h' | '12h' | '24h')}
                      className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    >
                      <option value="6h">Every 5–6 hours (Recommended)</option>
                      <option value="12h">Every 12 hours</option>
                      <option value="24h">Once daily (24 hours)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-4 sm:px-6 py-3">
              <span className="text-[11px] sm:text-xs font-medium text-emerald-700">
                {settingsSavedMsg || '🔒 Private settings excluded from Git'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-xl border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={handleSaveCloudSettings}
                  className="rounded-xl bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVALUATE CUSTOM JOB MODAL */}
      {showEvaluateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-stone-200 space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-stone-900">
                  Evaluate Custom Job with Gemini
                </h3>
                <p className="text-xs text-stone-500">
                  Paste any job description from LinkedIn, Welcome to the Jungle, or a company page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEvaluateModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Job Title</label>
                <input
                  type="text"
                  placeholder="e.g. AI Engineer, React Developer"
                  value={evalJobTitle}
                  onChange={(e) => setEvalJobTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Company</label>
                <input
                  type="text"
                  placeholder="e.g. Mistral AI, Doctolib"
                  value={evalCompany}
                  onChange={(e) => setEvalCompany(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-stone-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Job Description / Posting Text
              </label>
              <textarea
                rows={6}
                placeholder="Paste the full job description text here..."
                value={evalJobText}
                onChange={(e) => setEvalJobText(e.target.value)}
                className="w-full rounded-xl border border-stone-300 p-3 text-xs text-stone-800 focus:outline-none focus:border-stone-500 font-mono"
              />
            </div>

            {evalError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-medium">
                {evalError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
              <span className="text-[11px] text-stone-500">
                ✓ Scored with Gemini AI & your Master Prompt
              </span>
              <button
                type="button"
                disabled={isEvaluating}
                onClick={handleRunGeminiEvaluation}
                className="rounded-xl bg-stone-900 px-5 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
              >
                {isEvaluating ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <span>Run Gemini Evaluation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCORE BREAKDOWN & FULL JOB DETAILS MODAL */}
      {selectedJobDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-stone-200 p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {selectedJobDetails.jobCategory}
                  </span>
                  <span className="text-xs text-stone-400">•</span>
                  <span className="text-xs text-stone-500">🕒 {selectedJobDetails.publicationDate}</span>
                </div>
                <h3 className="text-base font-bold text-stone-900">{selectedJobDetails.exactJobTitle}</h3>
                <p className="text-xs text-stone-500">
                  {selectedJobDetails.companyName} • 📍 {selectedJobDetails.city}, {selectedJobDetails.region} ({selectedJobDetails.workingArrangement})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobDetails(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            {/* Full Summary & 3 Key Points to Emphasize */}
            <div className="rounded-xl border border-stone-200 bg-[#fdfcf9] p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-800">✨ Evaluation Summary</span>
                <span className="text-[11px] font-medium text-emerald-700">
                  {selectedJobDetails.scoredBy === 'gemini' ? '✨ Scored by Gemini AI' : '⚙️ Keyword Formula'}
                </span>
              </div>
              <p className="text-stone-700 leading-relaxed">{selectedJobDetails.geminiSummary}</p>

              {selectedJobDetails.threeRequirementsToEmphasize?.length > 0 && (
                <div className="pt-2 border-t border-stone-200/70 space-y-1">
                  <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider block">
                    3 Key Points to Emphasize in Your Application:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-stone-700">
                    {selectedJobDetails.threeRequirementsToEmphasize.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 100-Point Score Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-200">
                <span className="text-xs font-semibold text-stone-800">Overall Match Score</span>
                <span className="text-sm sm:text-base font-bold text-emerald-800">
                  {selectedJobDetails.overallScore} / 100 ({selectedJobDetails.matchCategory})
                </span>
              </div>

              <div className="space-y-1.5 text-xs px-1">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">1. Technical Skills & Responsibilities (max 35):</span>
                  <span className="font-semibold text-stone-900">{selectedJobDetails.scoreBreakdown.technicalSkillsScore} / 35</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">2. Alignment with Verified Experience (max 25):</span>
                  <span className="font-semibold text-stone-900">{selectedJobDetails.scoreBreakdown.experienceAlignmentScore} / 25</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">3. Seniority & Realistic Role Fit (max 15):</span>
                  <span className="font-semibold text-stone-900">{selectedJobDetails.scoreBreakdown.seniorityFitScore} / 15</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">4. Relevance to AI / React / Combined (max 15):</span>
                  <span className="font-semibold text-stone-900">{selectedJobDetails.scoreBreakdown.relevanceScore} / 15</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">5. Working Arrangement & Eligibility (max 10):</span>
                  <span className="font-semibold text-stone-900">{selectedJobDetails.scoreBreakdown.workingArrangementScore} / 10</span>
                </div>
                <div className="flex items-center justify-between text-stone-400 pt-1 border-t border-stone-100">
                  <span>Salary ({selectedJobDetails.salary}):</span>
                  <span className="font-medium text-stone-500">0 pts (Zero score impact)</span>
                </div>
              </div>
            </div>

            {selectedJobDetails.missingOrWeakerRequirements.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1 text-xs">
                <span className="font-semibold text-amber-900">Missing or Weaker Requirements flagged:</span>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  {selectedJobDetails.missingOrWeakerRequirements.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
              <div className="text-xs text-stone-600">
                <span>Recommended CV: </span>
                <strong className="text-stone-900">{selectedJobDetails.recommendedCv}</strong>
                <span className="block text-[11px] text-stone-400">{selectedJobDetails.cvRecommendationReason}</span>
              </div>
              <a
                href={selectedJobDetails.directApplicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
              >
                Open Official Job Page ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
