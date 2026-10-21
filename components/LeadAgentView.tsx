'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EvaluatedJob, DashboardTab, UserStatus } from '@/lib/lead-agent/types';
import { DEFAULT_GENERIC_MASTER_PROMPT } from '@/lib/lead-agent/master-prompt';

interface LeadAgentViewProps {
  onBackToChat?: () => void;
  onOpenSidebar?: () => void;
}

// Professional SVG icons (Apple-inspired minimalist design — zero random emojis)
function MapPinIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function BriefcaseIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function SparklesIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function BookmarkIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function ArchiveIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

function FileTextIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function InboxIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function GripVerticalIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function EyeIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function XIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function cleanLocation(city: string, region: string): string {
  const c = (city || '').trim();
  const r = (region || '').trim();
  if (!c && !r) return 'France';
  if (c && r && r.toLowerCase().includes(c.toLowerCase())) return r;
  if (c && r) return `${c}, ${r}`;
  return c || r;
}

function formatLastScanTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';

    const timeStr = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return `${dateStr} at ${timeStr}`;
  } catch {
    return '';
  }
}

function getJobSourceBadge(job: EvaluatedJob) {
  const isWttj =
    job.source?.toLowerCase().includes('jungle') ||
    job.source?.toLowerCase().includes('wttj') ||
    job.id.startsWith('wttj-') ||
    (job.directApplicationUrl && job.directApplicationUrl.includes('welcometothejungle.com'));

  if (isWttj) {
    return {
      label: 'Welcome to the Jungle',
      shortLabel: 'WTTJ',
      className: 'bg-amber-50 text-amber-800 border-amber-200/80',
    };
  }

  return {
    label: 'LinkedIn France',
    shortLabel: 'LinkedIn',
    className: 'bg-sky-50 text-sky-800 border-sky-200/80',
  };
}

const TAB_DISPLAY_LABELS: Record<DashboardTab, string> = {
  'All Jobs': 'All Jobs',
  'Combined AI + Software Engineering': 'AI + Full-Stack',
  'AI Engineering': 'AI Engineering',
  'React / Frontend': 'React / Frontend',
  'Related Opportunities': 'Related',
  'Saved Jobs': 'Shortlisted',
  'Applied Jobs': 'Applied',
  'Interviewing Jobs': 'Interviewing',
  'Archived or Rejected Jobs': 'Archived',
};

interface KanbanColumnConfig {
  id: UserStatus;
  title: string;
  iconType: 'inbox' | 'saved' | 'applied' | 'interviewing' | 'archived';
  emptyHint: string;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: 'inbox',
    title: 'New Leads',
    iconType: 'inbox',
    emptyHint: 'No leads in inbox. Run a scan to discover fresh jobs.',
  },
  {
    id: 'saved',
    title: 'Shortlisted',
    iconType: 'saved',
    emptyHint: 'Drag jobs here to shortlist for application.',
  },
  {
    id: 'applied',
    title: 'Applied',
    iconType: 'applied',
    emptyHint: 'Drag jobs here once you have submitted your CV.',
  },
  {
    id: 'interviewing',
    title: 'Interviewing',
    iconType: 'interviewing',
    emptyHint: 'Drag jobs here when invited to interview rounds.',
  },
  {
    id: 'archived',
    title: 'Archived',
    iconType: 'archived',
    emptyHint: 'Drag jobs here to archive or pass.',
  },
];

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

  // View Mode: List Feed vs. Azure DevOps / Kanban Task Board
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

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

  // Local UI Filters (persisted in localStorage so user searches are retained across logins and refreshes)
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('All France');
  const [platformFilter, setPlatformFilter] = useState<'All' | 'LinkedIn' | 'WTTJ' | string>('All');
  const [arrangementFilter, setArrangementFilter] = useState<'All' | 'Remote' | 'Hybrid' | 'On-site'>('All');
  const [scoreFilter, setScoreFilter] = useState<'All' | '85+' | '70-84' | '55-69'>('All');
  const [languageFilter, setLanguageFilter] = useState<'All' | 'EN' | 'FR'>('All');
  const [freshnessFilter, setFreshnessFilter] = useState<'All' | 'New' | 'Previously Seen'>('All');
  const [sortOrder, setSortOrder] = useState<'newest_posted' | 'new_scraped_first' | 'highest_score'>('newest_posted');
  const [isClientMounted, setIsClientMounted] = useState(false);

  // Hydrate filters & cached state safely on client mount (prevents SSR hydration mismatch)
  useEffect(() => {
    setIsClientMounted(true);
    try {
      const savedTab = localStorage.getItem('lead_agent_tab');
      if (savedTab) setActiveTab(savedTab as DashboardTab);

      const savedMode = localStorage.getItem('lead_agent_view_mode');
      if (savedMode === 'list' || savedMode === 'kanban') setViewMode(savedMode);

      const cachedJobs = localStorage.getItem('lead_agent_cached_jobs');
      if (cachedJobs) {
        const parsed = JSON.parse(cachedJobs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setJobs(parsed);
          setLoadingJobs(false);
        }
      }

      const cachedScan = localStorage.getItem('lead_agent_cached_last_scan');
      if (cachedScan) setLastScanAt(cachedScan);

      const savedQuick = localStorage.getItem('lead_agent_quick_search');
      if (savedQuick) setQuickSearchInput(savedQuick);

      const savedSearch = localStorage.getItem('lead_agent_search');
      if (savedSearch) setSearchQuery(savedSearch);

      const savedRegion = localStorage.getItem('lead_agent_region');
      if (savedRegion) setRegionFilter(savedRegion);

      const savedArr = localStorage.getItem('lead_agent_arrangement');
      if (savedArr) setArrangementFilter(savedArr as any);

      const savedScore = localStorage.getItem('lead_agent_score');
      if (savedScore) setScoreFilter(savedScore as any);

      const savedPlatform = localStorage.getItem('lead_agent_platform');
      if (savedPlatform) setPlatformFilter(savedPlatform);

      const savedLang = localStorage.getItem('lead_agent_lang');
      if (savedLang) setLanguageFilter(savedLang as any);

      const savedFresh = localStorage.getItem('lead_agent_freshness');
      if (savedFresh) setFreshnessFilter(savedFresh as any);

      const savedSort = localStorage.getItem('lead_agent_sort');
      if (savedSort) setSortOrder(savedSort as any);
    } catch {}
  }, []);

  // Keep filters synced to localStorage once mounted
  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_view_mode', viewMode); } catch {}
  }, [viewMode, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_tab', activeTab); } catch {}
  }, [activeTab, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_search', searchQuery); } catch {}
  }, [searchQuery, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_region', regionFilter); } catch {}
  }, [regionFilter, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_arrangement', arrangementFilter); } catch {}
  }, [arrangementFilter, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_score', scoreFilter); } catch {}
  }, [scoreFilter, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_platform', platformFilter); } catch {}
  }, [platformFilter, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_lang', languageFilter); } catch {}
  }, [languageFilter, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_freshness', freshnessFilter); } catch {}
  }, [freshnessFilter, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_sort', sortOrder); } catch {}
  }, [sortOrder, isClientMounted]);

  useEffect(() => {
    if (!isClientMounted) return;
    try { localStorage.setItem('lead_agent_quick_search', quickSearchInput); } catch {}
  }, [quickSearchInput, isClientMounted]);

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
        const scanTime = data.lastScanAt || new Date().toISOString();
        setLastScanAt(scanTime);
        setScanBanner(data.summary || `Scan complete: ${data.allJobs.length} total verified jobs.`);
        try {
          localStorage.setItem('lead_agent_cached_jobs', JSON.stringify(data.allJobs));
          localStorage.setItem('lead_agent_cached_last_scan', scanTime);
        } catch {}
      } else {
        setScanBanner(data.error || 'Could not complete live scan.');
      }
    } catch (err: any) {
      setScanBanner(err?.message || 'Network error while scanning France jobs.');
    } finally {
      setIsScanningFrance(false);
    }
  }, []);

  // Load persisted jobs on mount; NEVER automatically trigger live scan without user action
  useEffect(() => {
    let mounted = true;
    async function initJobs() {
      try {
        const res = await fetch('/api/lead-agent/jobs');
        const data = await res.json();
        if (!mounted) return;

        if (res.ok && Array.isArray(data.jobs) && data.jobs.length > 0) {
          setJobs(data.jobs);
          if (data.lastScanAt) setLastScanAt(data.lastScanAt);
          if (data.lastScanSummary) setScanBanner(data.lastScanSummary);
          try {
            localStorage.setItem('lead_agent_cached_jobs', JSON.stringify(data.jobs));
            if (data.lastScanAt) {
              localStorage.setItem('lead_agent_cached_last_scan', data.lastScanAt);
            }
          } catch {}
        }
      } catch {
        // Fallback to locally cached jobs
      } finally {
        if (mounted) setLoadingJobs(false);
      }
    }
    initJobs();
    return () => {
      mounted = false;
    };
  }, []);

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

  const updateJobStatus = async (id: string, newStatus: UserStatus) => {
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

  // Seamless Universal Pointer & Touch Drag-and-Drop state (Desktop & Mobile)
  const [activeDragJob, setActiveDragJob] = useState<EvaluatedJob | null>(null);
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCardDimensions, setDragCardDimensions] = useState<{ width: number; height: number } | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<UserStatus | null>(null);
  const [mobileMoveJob, setMobileMoveJob] = useState<EvaluatedJob | null>(null);
  const kanbanContainerRef = useRef<HTMLDivElement | null>(null);
  const dragJobRef = useRef<EvaluatedJob | null>(null);
  dragJobRef.current = activeDragJob;

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{
    job: EvaluatedJob;
    startX: number;
    startY: number;
    cardEl: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
    };
  }, []);

  // Geometric column hit-testing by coordinate (robust across iPhone, mobile touch, and desktop)
  const getColumnAtCoordinates = (x: number, y?: number): UserStatus | null => {
    // 1. Mobile & desktop quick pill hit-testing (drag directly onto top column pills)
    if (typeof y === 'number') {
      for (const col of KANBAN_COLUMNS) {
        const pillEl = document.getElementById(`kanban-pill-${col.id}`);
        if (pillEl) {
          const rect = pillEl.getBoundingClientRect();
          if (x >= rect.left - 8 && x <= rect.right + 8 && y >= rect.top - 12 && y <= rect.bottom + 20) {
            return col.id;
          }
        }
      }
    }

    // 2. Full column body hit-testing
    for (const col of KANBAN_COLUMNS) {
      const el = document.getElementById(`kanban-col-${col.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right) {
          return col.id;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    if (!activeDragJob) return;

    // Temporarily disable CSS scroll-snap on the container during drag so iOS Safari doesn't fight the drag
    if (kanbanContainerRef.current) {
      kanbanContainerRef.current.style.touchAction = 'none';
      kanbanContainerRef.current.style.scrollSnapType = 'none';
    }

    const checkEdgeAutoScroll = (x: number) => {
      if (kanbanContainerRef.current) {
        const container = kanbanContainerRef.current;
        const rect = container.getBoundingClientRect();
        if (x < rect.left + 50) {
          container.scrollLeft -= 14;
        } else if (x > rect.right - 50) {
          container.scrollLeft += 14;
        }
      }
    };

    const handleMoveCoords = (x: number, y: number) => {
      setDragPointerPos({ x, y });
      checkEdgeAutoScroll(x);
      const targetCol = getColumnAtCoordinates(x, y);
      setDragOverColumnId(targetCol);
    };

    const handleDropCoords = (x: number, y: number) => {
      const currentJob = dragJobRef.current;
      if (currentJob) {
        const targetCol = getColumnAtCoordinates(x, y);
        if (targetCol && targetCol !== currentJob.userStatus) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([20, 30, 20]); } catch {}
          }
          updateJobStatus(currentJob.id, targetCol);
        }
      }
      dragJobRef.current = null;
      setActiveDragJob(null);
      setDragPointerPos(null);
      setDragCardDimensions(null);
      setDragOverColumnId(null);
    };

    // 1. Touch listeners with cancelable check
    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleMoveCoords(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (touch) handleDropCoords(touch.clientX, touch.clientY);
      else handleDropCoords(0, 0);
    };

    // 2. Pointer listeners for unified touch & desktop mouse
    const handlePointerMove = (e: PointerEvent) => {
      handleMoveCoords(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: PointerEvent) => {
      handleDropCoords(e.clientX, e.clientY);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      if (kanbanContainerRef.current) {
        kanbanContainerRef.current.style.touchAction = '';
        kanbanContainerRef.current.style.scrollSnapType = '';
      }
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [activeDragJob]);

  // Activates the floating drag ghost and begins tracking
  const startActiveDrag = (job: EvaluatedJob, clientX: number, clientY: number, cardEl: HTMLElement | null) => {
    const rect = cardEl ? cardEl.getBoundingClientRect() : null;
    dragJobRef.current = job;
    setActiveDragJob(job);
    setDragPointerPos({ x: clientX, y: clientY });
    setDragCardDimensions(rect ? { width: rect.width, height: rect.height } : { width: 280, height: 140 });
    setDragOverColumnId(job.userStatus);
  };

  // Desktop mouse drag from handle
  const handleGripPointerDown = (e: React.PointerEvent, job: EvaluatedJob) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('select')) {
      return;
    }
    const cardEl = (e.currentTarget as HTMLElement).closest('[data-job-card]') as HTMLElement | null;
    startActiveDrag(job, e.clientX, e.clientY, cardEl);
  };

  // Mobile / Touch press-and-hold drag on handle:
  // Requires intentional 200ms hold. If the user moves > 8px (swiping or scrolling),
  // the hold is immediately cancelled and native smooth column sliding proceeds uninterrupted.
  const handleGripTouchStart = (e: React.TouchEvent, job: EvaluatedJob) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('select')) {
      return;
    }

    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const cardEl = (e.currentTarget as HTMLElement).closest('[data-job-card]') as HTMLElement | null;
    const startX = touch.clientX;
    const startY = touch.clientY;

    touchStartRef.current = {
      job,
      startX,
      startY,
      cardEl,
    };

    const cleanupEarlyTouch = () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      touchStartRef.current = null;
      window.removeEventListener('touchmove', onEarlyTouchMove);
      window.removeEventListener('touchend', cleanupEarlyTouch);
      window.removeEventListener('touchcancel', cleanupEarlyTouch);
    };

    const onEarlyTouchMove = (evt: TouchEvent) => {
      const t = evt.touches[0];
      if (t) {
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        // Finger moved: user is sliding between sections or scrolling cards.
        // Immediately abort the drag intent so scrolling happens smoothly without any accidental drag!
        if (dx > 8 || dy > 8) {
          cleanupEarlyTouch();
        }
      }
    };

    window.addEventListener('touchmove', onEarlyTouchMove, { passive: true });
    window.addEventListener('touchend', cleanupEarlyTouch, { once: true });
    window.addEventListener('touchcancel', cleanupEarlyTouch, { once: true });

    touchTimerRef.current = setTimeout(() => {
      window.removeEventListener('touchmove', onEarlyTouchMove);
      window.removeEventListener('touchend', cleanupEarlyTouch);
      window.removeEventListener('touchcancel', cleanupEarlyTouch);

      if (touchStartRef.current) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(35); } catch {}
        }
        startActiveDrag(touchStartRef.current.job, touchStartRef.current.startX, touchStartRef.current.startY, touchStartRef.current.cardEl);
      }
      touchTimerRef.current = null;
      touchStartRef.current = null;
    }, 200);
  };

  // Tab membership rule:
  // - 'Applied Jobs' holds jobs marked as applied
  // - 'Interviewing Jobs' holds jobs in interview stage
  // - 'Archived or Rejected Jobs' holds archived jobs
  // - 'Saved Jobs' holds saved jobs
  // - 'All Jobs' and the 4 Category tabs ONLY show active (non-applied, non-interviewing, non-archived) jobs
  const matchesTab = (job: EvaluatedJob, tab: DashboardTab): boolean => {
    if (tab === 'Saved Jobs') return job.userStatus === 'saved';
    if (tab === 'Applied Jobs') return job.userStatus === 'applied';
    if (tab === 'Interviewing Jobs') return job.userStatus === 'interviewing';
    if (tab === 'Archived or Rejected Jobs') return job.userStatus === 'archived';
    if (job.userStatus === 'applied' || job.userStatus === 'interviewing' || job.userStatus === 'archived') return false;
    if (tab === 'All Jobs') return true;
    return job.jobCategory === tab;
  };

  // Helper for Kanban Task Board: filters jobs belonging to each column
  const getKanbanColumnJobs = (status: UserStatus): EvaluatedJob[] => {
    return jobs
      .filter((job) => {
        if (job.userStatus !== status) return false;
        if (
          activeTab !== 'All Jobs' &&
          activeTab !== 'Saved Jobs' &&
          activeTab !== 'Applied Jobs' &&
          activeTab !== 'Interviewing Jobs' &&
          activeTab !== 'Archived or Rejected Jobs'
        ) {
          if (job.jobCategory !== activeTab) return false;
        }
        return (
          matchesBaseFilters(job) &&
          matchesLanguageFilter(job, languageFilter) &&
          matchesFreshnessFilter(job, freshnessFilter)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'new_scraped_first') {
          const aIsNew = a.listingStatus === 'New' ? 1 : 0;
          const bIsNew = b.listingStatus === 'New' ? 1 : 0;
          if (aIsNew !== bIsNew) return bIsNew - aIsNew;
        }

        if (sortOrder === 'highest_score') {
          if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        }

        const aAge = parsePostedAgeMinutes(a.publicationDate);
        const bAge = parsePostedAgeMinutes(b.publicationDate);
        if (aAge !== bAge) return aAge - bAge;

        return b.overallScore - a.overallScore;
      });
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

    if (platformFilter !== 'All') {
      const badge = getJobSourceBadge(job);
      if (platformFilter === 'LinkedIn' && badge.shortLabel !== 'LinkedIn') return false;
      if (platformFilter === 'WTTJ' && badge.shortLabel !== 'WTTJ') return false;
    }

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
    (platformFilter !== 'All' ? 1 : 0) +
    (freshnessFilter === 'Previously Seen' ? 1 : 0) +
    (sortOrder !== 'newest_posted' ? 1 : 0);

  const resetAllFilters = () => {
    setSearchQuery('');
    setRegionFilter('All France');
    setPlatformFilter('All');
    setArrangementFilter('All');
    setScoreFilter('All');
    setLanguageFilter('All');
    setFreshnessFilter('All');
    setSortOrder('newest_posted');
    try {
      localStorage.removeItem('lead_agent_search');
      localStorage.removeItem('lead_agent_region');
      localStorage.removeItem('lead_agent_platform');
      localStorage.removeItem('lead_agent_arrangement');
      localStorage.removeItem('lead_agent_score');
      localStorage.removeItem('lead_agent_lang');
      localStorage.removeItem('lead_agent_freshness');
      localStorage.removeItem('lead_agent_sort');
    } catch {}
  };

  const getScoreColorBadge = (score: number) => {
    if (score >= 85) return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    if (score >= 70) return 'bg-sky-50 text-sky-800 border-sky-200/80';
    if (score >= 55) return 'bg-amber-50 text-amber-800 border-amber-200/80';
    return 'bg-stone-100 text-stone-600 border-stone-200/80';
  };

  return (
    <div className="flex h-full min-h-[100dvh] max-h-[100dvh] flex-col bg-[#fdfcf9] text-stone-800 overscroll-none select-none md:select-auto">
      {/* Row 1: Clean, Responsive Top Header (iOS Safe Area Aware) */}
      <header className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[#ded9cf] bg-[#fdfcf9] px-3 sm:px-6 py-2.5 sm:py-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#ded9cf] bg-white text-stone-600 hover:bg-[#eeece5] active:scale-95 transition md:hidden"
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
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="truncate text-sm sm:text-base font-bold tracking-tight text-stone-900">
                Lead Agent · France
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {geminiApiKey ? 'Gemini AI' : 'Active'}
              </span>
            </div>
            <p className="truncate text-[10px] sm:text-[11px] text-stone-500">
              {candidateName ? `${candidateName} • ` : ''}All France
              {lastScanAt && (
                <span className="ml-1.5 text-stone-400">
                  • Scanned {formatLastScanTime(lastScanAt)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onBackToChat && (
            <button
              type="button"
              onClick={onBackToChat}
              className="flex md:hidden items-center gap-1 rounded-xl border border-[#ded9cf] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#eeece5] active:scale-95 transition"
            >
              <span>💬 Chat</span>
            </button>
          )}

          <button
            type="button"
            disabled={isScanningFrance}
            onClick={() => handleTriggerLiveScan()}
            className="hidden sm:flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-50 transition active:scale-95"
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
            <span>+</span>
            <span className="hidden sm:inline">Evaluate Job</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileModalTab('profile');
              setShowProfileModal(true);
            }}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[#ded9cf] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-[#eeece5] transition active:scale-95"
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
              'Interviewing Jobs',
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
                  ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                  : newScrapedCount > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-[#f4f2ec] text-stone-600 border-transparent hover:bg-[#e8e4db]'
              }`}
              title="Toggle showing only newly scraped jobs from the latest scan"
            >
              New ({newScrapedCount})
            </button>

            {/* Compact Language Segmented Control */}
            <div className="inline-flex items-center rounded-xl bg-[#f4f2ec] p-0.5 border border-[#ded9cf]/60">
              {(
                [
                  { id: 'All', label: `All (${allLangJobsCount})` },
                  { id: 'EN', label: `EN (${enJobsCount})` },
                  { id: 'FR', label: `FR (${frJobsCount})` },
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

          {/* Right: View Mode Toggle (List vs Kanban Board) + Region Dropdown + Collapsible Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Azure DevOps / Kanban View Mode Switcher */}
            <div className="inline-flex items-center rounded-xl bg-[#f4f2ec] p-0.5 border border-[#ded9cf]">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === 'list'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Feed List View"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>List</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === 'kanban'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Task Manager Drag-and-Drop Board"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="4" width="5" height="16" rx="1.5" />
                  <rect x="10" y="4" width="5" height="11" rx="1.5" />
                  <rect x="17" y="4" width="5" height="14" rx="1.5" />
                </svg>
                <span>Board</span>
              </button>
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="max-w-[170px] sm:max-w-none rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:outline-none"
            >
              <option value="All France">All France</option>
              <option value="Outside Paris">Outside Paris</option>
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

            {/* Platform Filter Dropdown (All Platforms, LinkedIn, Welcome to the Jungle) */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="max-w-[170px] sm:max-w-none rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-2.5 py-1.5 text-xs font-semibold text-stone-800 focus:outline-none"
              title="Filter by job platform"
            >
              <option value="All">All Platforms</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="WTTJ">Welcome to the Jungle</option>
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
              <span>Filters</span>
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
                    <option value="newest_posted">Newest Published</option>
                    <option value="new_scraped_first">Newly Discovered First</option>
                    <option value="highest_score">Highest Match Score</option>
                  </select>
                </div>

                {/* Batch Status */}
                <div className="flex items-center gap-1">
                  <span className="text-stone-500 font-medium">Batch:</span>
                  {(
                    [
                      { id: 'All', label: `All (${newScrapedCount + oldScrapedCount})` },
                      { id: 'New', label: `New (${newScrapedCount})` },
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

                {/* Platform / Source */}
                <div className="flex items-center gap-1">
                  <span className="text-stone-500 font-medium">Source:</span>
                  {(
                    [
                      { id: 'All', label: 'All' },
                      { id: 'LinkedIn', label: 'LinkedIn' },
                      { id: 'WTTJ', label: 'WTTJ' },
                    ] as const
                  ).map((pf) => (
                    <button
                      key={pf.id}
                      type="button"
                      onClick={() => setPlatformFilter(pf.id)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                        platformFilter === pf.id
                          ? 'bg-stone-900 text-white font-semibold'
                          : 'bg-white text-stone-600 border border-[#ded9cf] hover:bg-[#eeece5]'
                      }`}
                    >
                      {pf.label}
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

      {/* Main Jobs Area: Responsive Feed vs. Azure DevOps / Kanban Task Board */}
      {loadingJobs || (isScanningFrance && jobs.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-4 flex-1">
          <div className="h-8 w-8 rounded-full border-2 border-stone-800 border-t-transparent animate-spin" />
          <p className="text-sm font-semibold text-stone-800">
            Discovering & evaluating live jobs across France...
          </p>
          <p className="text-xs text-stone-500 max-w-md">
            Querying public France job listings for AI Engineering, React/Frontend, and Full-Stack roles, deduplicating, and scoring against your profile.
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Azure DevOps / Task Manager-style Kanban Board with HTML5 Drag-and-Drop & Mobile Snapping */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Mobile-Only Quick Column Switcher & Interactive Drop Targets */}
          <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto px-3 py-2 bg-[#f7f5f0] border-b border-[#ded9cf] scrollbar-none shrink-0">
            {activeDragJob && (
              <span className="text-[10px] font-bold text-amber-800 shrink-0 uppercase tracking-wider bg-amber-100/90 px-2 py-0.5 rounded-md animate-pulse">
                Drop to:
              </span>
            )}
            {KANBAN_COLUMNS.map((col) => {
              const colJobs = getKanbanColumnJobs(col.id);
              const isTargetOver = dragOverColumnId === col.id;
              const isSource = activeDragJob?.userStatus === col.id;

              return (
                <button
                  key={col.id}
                  id={`kanban-pill-${col.id}`}
                  type="button"
                  onClick={() => {
                    if (activeDragJob) {
                      updateJobStatus(activeDragJob.id, col.id);
                      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        try { navigator.vibrate([20, 30, 20]); } catch {}
                      }
                      setActiveDragJob(null);
                      setDragPointerPos(null);
                      setDragCardDimensions(null);
                      setDragOverColumnId(null);
                      return;
                    }
                    const el = document.getElementById(`kanban-col-${col.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isTargetOver
                      ? 'bg-stone-900 text-white ring-2 ring-stone-900 scale-105 shadow-md'
                      : activeDragJob
                      ? isSource
                        ? 'bg-stone-100 text-stone-400 border border-stone-200 opacity-60'
                        : 'bg-amber-50 text-amber-900 border-2 border-dashed border-amber-400 shadow-xs'
                      : 'bg-white text-stone-700 border border-stone-200/80 shadow-2xs active:bg-stone-100'
                  }`}
                >
                  <span>{col.title}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isTargetOver ? 'bg-white text-stone-900' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {colJobs.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            ref={kanbanContainerRef}
            className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 sm:px-6 py-4 snap-x snap-mandatory scroll-smooth"
          >
            <div className="flex gap-3 sm:gap-4 h-full min-w-max pb-2">
              {KANBAN_COLUMNS.map((col) => {
                const colJobs = getKanbanColumnJobs(col.id);
                const isOver = dragOverColumnId === col.id && activeDragJob?.userStatus !== col.id;

                return (
                  <div
                    key={col.id}
                    id={`kanban-col-${col.id}`}
                    data-kanban-column-id={col.id}
                    className={`w-[85vw] max-w-[320px] sm:w-80 shrink-0 snap-center flex flex-col rounded-2xl border transition-all duration-150 ${
                      isOver
                        ? 'border-stone-500 bg-stone-100/90 ring-2 ring-stone-400 shadow-md scale-[1.01]'
                        : 'border-stone-200/70 bg-stone-50/60 hover:border-stone-300'
                    }`}
                  >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/70 bg-white/70 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      {col.iconType === 'inbox' && <InboxIcon className="w-4 h-4 text-stone-500" />}
                      {col.iconType === 'saved' && <BookmarkIcon className="w-4 h-4 text-stone-500" />}
                      {col.iconType === 'applied' && <CheckCircleIcon className="w-4 h-4 text-stone-500" />}
                      {col.iconType === 'interviewing' && <CalendarIcon className="w-4 h-4 text-stone-500" />}
                      {col.iconType === 'archived' && <ArchiveIcon className="w-4 h-4 text-stone-500" />}
                      <span className="text-xs font-semibold text-stone-800 tracking-tight">{col.title}</span>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-stone-200/60 text-stone-600">
                      {colJobs.length}
                    </span>
                  </div>

                  {/* Column Cards Container (Vertical Scroll) */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[140px]">
                    {colJobs.length === 0 ? (
                      <div className="h-full min-h-[120px] rounded-xl border border-dashed border-stone-200 flex flex-col items-center justify-center p-4 text-center text-stone-400">
                        <p className="text-[11px] font-medium leading-relaxed">{col.emptyHint}</p>
                      </div>
                    ) : (
                      colJobs.map((job) => {
                        const isFrCv = job.recommendedCv === 'CV_FR.pdf';
                        const isNewlyScraped = job.listingStatus === 'New';
                        const isDragging = activeDragJob?.id === job.id;
                        const sourceBadge = getJobSourceBadge(job);

                        return (
                          <div
                            key={job.id}
                            data-job-card={job.id}
                            className={`group relative rounded-xl border bg-white p-3.5 transition-all duration-150 space-y-2.5 select-none ${
                              isDragging
                                ? 'opacity-30 border-dashed border-2 border-stone-400 bg-stone-50 scale-[0.98]'
                                : 'border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-stone-300'
                            }`}
                          >
                            {/* Header: Grip Handle + Company + Minimalist Score */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div
                                  onTouchStart={(e) => handleGripTouchStart(e, job)}
                                  onPointerDown={(e) => handleGripPointerDown(e, job)}
                                  className="flex items-center justify-center p-1.5 text-stone-400 group-hover:text-stone-600 active:text-stone-900 cursor-grab active:cursor-grabbing select-none"
                                  style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
                                  title="Hold to drag (Touch) or click & drag (Mouse)"
                                >
                                  <GripVerticalIcon className="w-4 h-4 shrink-0" />
                                </div>
                                <span className="text-xs font-semibold text-stone-800 truncate">
                                  {job.companyName}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJobDetails(job);
                                }}
                                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${getScoreColorBadge(job.overallScore)}`}
                                title="Click to view 100-pt breakdown"
                              >
                                {job.overallScore}
                              </button>
                            </div>

                            {/* Title */}
                            <h4
                              onClick={() => setSelectedJobDetails(job)}
                              className="text-xs font-semibold text-stone-900 leading-snug line-clamp-2 hover:text-stone-600 transition cursor-pointer"
                            >
                              {job.exactJobTitle}
                            </h4>

                            {/* Location, Source & Time */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
                              <span className="truncate">{cleanLocation(job.city, job.region)}</span>
                              <span>·</span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-semibold border ${sourceBadge.className}`}
                                title={`Discovered on ${sourceBadge.label}`}
                              >
                                {sourceBadge.shortLabel}
                              </span>
                              <span>·</span>
                              <span className="shrink-0">{job.publicationDate}</span>
                              {isNewlyScraped && (
                                <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1 py-0.2 text-[9px] font-medium">
                                  New
                                </span>
                              )}
                            </div>

                            {/* CV Recommendation Pill + Actions */}
                            <div className="flex items-center justify-between gap-1 pt-2 border-t border-stone-100">
                              <span
                                className="inline-flex items-center gap-1 text-[10px] text-stone-500 font-medium"
                                title={job.cvRecommendationReason}
                              >
                                <FileTextIcon className="w-3 h-3 text-stone-400" />
                                <span>{isFrCv ? 'French CV' : 'English CV'}</span>
                              </span>

                              {/* Actions & 1-Click Status Dropdown (Touch-friendly) */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedJobDetails(job);
                                  }}
                                  className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition"
                                  title="View full details"
                                >
                                  <EyeIcon className="w-3.5 h-3.5" />
                                </button>

                                <a
                                  href={job.directApplicationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition"
                                  title={`Open ${sourceBadge.label} posting`}
                                >
                                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                                </a>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileMoveJob(job);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200/90 px-2 py-0.5 text-[11px] font-semibold text-stone-700 active:scale-95 transition"
                                  title="Change phase (1-tap menu)"
                                >
                                  <span>{KANBAN_COLUMNS.find((c) => c.id === job.userStatus)?.title || 'Move'}</span>
                                  <span className="text-[9px] text-stone-400">▾</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ) : (
        /* High-Clarity Apple-Style List Feed */
        <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2.5 px-4">
              <div className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                <EyeIcon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-stone-700">No jobs in this view match your current filters</p>
              <p className="text-xs text-stone-400 max-w-sm">
                Try resetting your filters or switching tabs above to see all available France roles.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-1 rounded-xl border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isFrCv = job.recommendedCv === 'CV_FR.pdf';
              const displayCvName = isFrCv ? cvFrName : cvEnName;
              const isNewlyScraped = job.listingStatus === 'New';
              const sourceBadge = getJobSourceBadge(job);

              return (
                <div
                  key={job.id}
                  className="group rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-150 space-y-3.5 sm:space-y-4"
                >
                  {/* Card Top: Metadata on Left, Apple-Style Score Badge on Right */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                      {/* Clean Company, Location & Contract Pill Row */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-semibold text-stone-900 text-sm tracking-tight">{job.companyName}</span>
                        <span className="text-stone-300">·</span>
                        <span className="inline-flex items-center gap-1 text-stone-500 font-medium">
                          <MapPinIcon className="w-3.5 h-3.5 text-stone-400" />
                          <span>{cleanLocation(job.city, job.region)}</span>
                        </span>
                        <span className="text-stone-300">·</span>
                        <span className="rounded-md bg-stone-100/90 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                          {job.employmentType} · {job.workingArrangement}
                        </span>
                        <span className="text-stone-300">·</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${sourceBadge.className}`}
                          title={`Discovered from ${sourceBadge.label}`}
                        >
                          {sourceBadge.shortLabel}
                        </span>
                        <span className="text-stone-300">·</span>
                        <span className="inline-flex items-center gap-1 text-stone-400 text-[11px]">
                          <ClockIcon className="w-3.5 h-3.5 text-stone-400" />
                          <span>{job.publicationDate}</span>
                        </span>
                        {isNewlyScraped && (
                          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-medium">
                            New
                          </span>
                        )}
                      </div>

                      {/* Prominent, Clean Job Title */}
                      <h3
                        onClick={() => setSelectedJobDetails(job)}
                        className="text-base sm:text-lg font-semibold tracking-tight text-stone-900 group-hover:text-stone-700 transition cursor-pointer leading-snug break-words"
                      >
                        {job.exactJobTitle}
                      </h3>
                    </div>

                    {/* Right: Apple-Style Match Score Badge */}
                    <div
                      onClick={() => setSelectedJobDetails(job)}
                      className="shrink-0 flex flex-col items-end cursor-pointer group-hover:opacity-90 transition pl-1 sm:pl-2"
                      title="Inspect score breakdown"
                    >
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 leading-none">
                          {job.overallScore}
                        </span>
                        <span className="text-xs font-normal text-stone-400">/100</span>
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wider uppercase mt-1 px-2 py-0.5 rounded-full border ${getScoreColorBadge(job.overallScore)}`}>
                        {job.matchCategory}
                      </span>
                    </div>
                  </div>

                  {/* Card Middle: Clean AI Summary Box */}
                  <div className="rounded-xl border border-stone-200/60 bg-stone-50/70 p-3 sm:p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
                        <SparklesIcon className="w-3.5 h-3.5 text-stone-400" />
                        <span>Match Insight</span>
                      </div>
                      <span className="text-[10px] font-medium text-stone-500 bg-stone-200/50 rounded-md px-2 py-0.5">
                        {TAB_DISPLAY_LABELS[job.jobCategory] || job.jobCategory}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-stone-600">{job.geminiSummary}</p>

                    {/* Skill Chips */}
                    {job.strongestMatchingSkills && job.strongestMatchingSkills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-200/40">
                        {job.strongestMatchingSkills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-md bg-white border border-stone-200/80 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: CV Pill on Left, Clean Action Group on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-1 border-t border-stone-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] max-w-full overflow-hidden"
                        title={job.cvRecommendationReason}
                      >
                        <FileTextIcon className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="shrink-0">Recommended:</span>
                        <span className="font-semibold text-stone-900 shrink-0">{isFrCv ? 'French CV' : 'English CV'}</span>
                        <span className="text-[10px] text-stone-400 font-mono truncate hidden xs:inline max-w-[130px]">({displayCvName})</span>
                      </span>
                    </div>

                    {/* Professional Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedJobDetails(job)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/80 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      >
                        <FileTextIcon className="w-3.5 h-3.5 text-stone-400" />
                        <span>Details</span>
                      </button>

                      {/* Stage Selector / Action Pills */}
                      <div className="inline-flex items-center rounded-xl bg-stone-100 p-0.5 border border-stone-200/70 text-xs">
                        <button
                          type="button"
                          onClick={() => updateJobStatus(job.id, job.userStatus === 'saved' ? 'inbox' : 'saved')}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium transition ${
                            job.userStatus === 'saved'
                              ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                          title="Shortlist/Save this role"
                        >
                          <BookmarkIcon className={`w-3.5 h-3.5 ${job.userStatus === 'saved' ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} />
                          <span>Shortlist</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateJobStatus(job.id, job.userStatus === 'applied' ? 'inbox' : 'applied')}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium transition ${
                            job.userStatus === 'applied'
                              ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                          title="Mark as Applied"
                        >
                          <CheckCircleIcon className={`w-3.5 h-3.5 ${job.userStatus === 'applied' ? 'text-emerald-600' : 'text-stone-400'}`} />
                          <span>Applied</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateJobStatus(job.id, job.userStatus === 'interviewing' ? 'inbox' : 'interviewing')}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium transition ${
                            job.userStatus === 'interviewing'
                              ? 'bg-white text-stone-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                          title="Mark as Interviewing"
                        >
                          <CalendarIcon className={`w-3.5 h-3.5 ${job.userStatus === 'interviewing' ? 'text-purple-600' : 'text-stone-400'}`} />
                          <span>Interview</span>
                        </button>
                      </div>

                      {job.userStatus !== 'archived' ? (
                        <button
                          type="button"
                          onClick={() => updateJobStatus(job.id, 'archived')}
                          className="rounded-xl border border-stone-200/80 bg-white p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition"
                          title="Archive"
                        >
                          <ArchiveIcon className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateJobStatus(job.id, 'inbox')}
                          className="rounded-xl border border-stone-200/80 bg-white px-2.5 py-1.5 text-xs text-stone-500 hover:text-stone-900 transition"
                        >
                          Restore
                        </button>
                      )}

                      <a
                        href={job.directApplicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      >
                        <span>Apply</span>
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PROFILE, MASTER PROMPT & API KEY CLOUD SETTINGS MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[90vh] sm:max-h-[92vh] rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl flex flex-col border border-stone-200 overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto sm:hidden mt-2 shrink-0" />
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-4 sm:px-6 py-3 bg-[#fdfcf9]">
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

      {/* SCORE BREAKDOWN & FULL JOB DETAILS MODAL (Native Bottom Sheet on Mobile) */}
      {selectedJobDetails && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full sm:max-w-xl max-h-[88vh] sm:max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-stone-200 p-4 sm:p-6 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto sm:hidden mb-1 shrink-0" />
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-md bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                    {selectedJobDetails.jobCategory}
                  </span>
                  <span className="text-xs text-stone-300">·</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${getJobSourceBadge(selectedJobDetails).className}`}>
                    {getJobSourceBadge(selectedJobDetails).label}
                  </span>
                  <span className="text-xs text-stone-300">·</span>
                  <span className="text-xs text-stone-500 inline-flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5 text-stone-400" />
                    <span>{selectedJobDetails.publicationDate}</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-stone-900">{selectedJobDetails.exactJobTitle}</h3>
                <p className="text-xs text-stone-500 inline-flex items-center gap-1 mt-0.5">
                  <span className="font-semibold text-stone-800">{selectedJobDetails.companyName}</span>
                  <span className="text-stone-300">·</span>
                  <MapPinIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>{cleanLocation(selectedJobDetails.city, selectedJobDetails.region)} ({selectedJobDetails.workingArrangement})</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobDetails(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Full Summary & 3 Key Points to Emphasize */}
            <div className="rounded-xl border border-stone-200 bg-[#fdfcf9] p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-800 inline-flex items-center gap-1.5">
                  <SparklesIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>Evaluation Summary</span>
                </span>
                <span className="text-[11px] font-medium text-stone-500">
                  {selectedJobDetails.scoredBy === 'gemini' ? 'Gemini AI' : 'Rubric'}
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

            {/* Full Scraped Job Description ("About the job") */}
            <div className="rounded-xl border border-stone-200/90 bg-[#fdfcf9] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-stone-200/70 pb-2">
                <span className="font-semibold text-stone-800 inline-flex items-center gap-1.5">
                  <BriefcaseIcon className="w-3.5 h-3.5 text-stone-500" />
                  <span>About the Job (Full Description)</span>
                </span>
                <span className="text-[11px] font-medium text-stone-400">
                  {selectedJobDetails.fullJobDescription ? 'Scraped Posting' : 'Summary'}
                </span>
              </div>
              <div className="text-stone-700 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto pr-1 text-xs select-text">
                {selectedJobDetails.fullJobDescription || selectedJobDetails.geminiSummary}
              </div>
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

            {/* Application Stage Selector in Modal */}
            <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3 space-y-2">
              <span className="text-xs font-semibold text-stone-700">Application Stage:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'inbox', label: 'Inbox', icon: <InboxIcon className="w-3.5 h-3.5" /> },
                    { id: 'saved', label: 'Shortlisted', icon: <BookmarkIcon className="w-3.5 h-3.5" /> },
                    { id: 'applied', label: 'Applied', icon: <CheckCircleIcon className="w-3.5 h-3.5" /> },
                    { id: 'interviewing', label: 'Interviewing', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
                    { id: 'archived', label: 'Archived', icon: <ArchiveIcon className="w-3.5 h-3.5" /> },
                  ] as const
                ).map((st) => {
                  const isCurrent = selectedJobDetails.userStatus === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        updateJobStatus(selectedJobDetails.id, st.id as UserStatus);
                        setSelectedJobDetails({ ...selectedJobDetails, userStatus: st.id as UserStatus });
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition border ${
                        isCurrent
                          ? 'bg-stone-900 text-white font-semibold border-stone-900 shadow-xs'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {st.icon}
                      <span>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
              <div className="text-xs text-stone-600 inline-flex items-center gap-1.5">
                <FileTextIcon className="w-3.5 h-3.5 text-stone-400" />
                <span>Recommended: </span>
                <strong className="text-stone-900">{selectedJobDetails.recommendedCv}</strong>
                <span className="text-[11px] text-stone-400 ml-1">({selectedJobDetails.cvRecommendationReason})</span>
              </div>
              <a
                href={selectedJobDetails.directApplicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800 shadow-xs transition"
              >
                <span>Open on {getJobSourceBadge(selectedJobDetails).shortLabel}</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Seamless Floating Card Drag Preview (Desktop & Mobile Touch) */}
      {activeDragJob && dragPointerPos && (
        <div
          className="fixed pointer-events-none z-[9999] shadow-2xl rounded-xl border border-stone-300/90 bg-white p-3.5 select-none transition-transform duration-75"
          style={{
            width: dragCardDimensions?.width || 280,
            left: Math.max(10, Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - (dragCardDimensions?.width || 280) - 10, dragPointerPos.x - (dragCardDimensions?.width ? dragCardDimensions.width / 2 : 140))),
            top: Math.max(10, dragPointerPos.y - 70),
            transform: 'rotate(2.5deg) scale(1.03)',
          }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <GripVerticalIcon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="text-xs font-semibold text-stone-800 truncate">
                {activeDragJob.companyName}
              </span>
            </div>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${getScoreColorBadge(activeDragJob.overallScore)}`}>
              {activeDragJob.overallScore}
            </span>
          </div>

          <h4 className="text-xs font-semibold text-stone-900 leading-snug line-clamp-2 mt-1.5">
            {activeDragJob.exactJobTitle}
          </h4>

          <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mt-1">
            <span className="truncate">{cleanLocation(activeDragJob.city, activeDragJob.region)}</span>
            <span>·</span>
            <span>{activeDragJob.publicationDate}</span>
          </div>

          <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500">
            <span>{activeDragJob.recommendedCv === 'CV_FR.pdf' ? 'French CV' : 'English CV'}</span>
            {dragOverColumnId && dragOverColumnId !== activeDragJob.userStatus ? (
              <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Move to: {KANBAN_COLUMNS.find((c) => c.id === dragOverColumnId)?.title}
              </span>
            ) : (
              <span className="text-stone-400">Release over phase to move</span>
            )}
          </div>
        </div>
      )}

      {/* Native iOS Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden shrink-0 border-t border-[#ded9cf] bg-white/95 backdrop-blur-md px-3 py-1.5 flex items-center justify-around z-30 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition active:scale-95 ${
            viewMode === 'list' ? 'text-stone-950 font-bold' : 'text-stone-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${viewMode === 'list' ? 'bg-stone-100' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={viewMode === 'list' ? 2.4 : 1.8}>
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[10px] tracking-tight">Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('kanban')}
          className={`flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition active:scale-95 ${
            viewMode === 'kanban' ? 'text-stone-950 font-bold' : 'text-stone-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${viewMode === 'kanban' ? 'bg-stone-100' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={viewMode === 'kanban' ? 2.4 : 1.8}>
              <rect x="3" y="4" width="5" height="16" rx="1.5" />
              <rect x="10" y="4" width="5" height="11" rx="1.5" />
              <rect x="17" y="4" width="5" height="14" rx="1.5" />
            </svg>
          </div>
          <span className="text-[10px] tracking-tight">Board</span>
        </button>

        <button
          type="button"
          disabled={isScanningFrance}
          onClick={() => handleTriggerLiveScan()}
          className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl text-amber-600 active:scale-95 transition"
        >
          <div className="p-1 rounded-lg bg-amber-50">
            {isScanningFrance ? (
              <span className="h-5 w-5 block rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-tight">Scan</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setProfileModalTab('profile');
            setShowProfileModal(true);
          }}
          className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl text-stone-600 active:scale-95 transition"
        >
          <div className="p-1 rounded-lg">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">
              {candidateName ? candidateName.charAt(0).toUpperCase() : '👤'}
            </span>
          </div>
          <span className="text-[10px] font-medium tracking-tight">Profile</span>
        </button>
      </nav>

      {/* 1-Tap Mobile Phase Movement Bottom Sheet */}
      {mobileMoveJob && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setMobileMoveJob(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-stone-200 shadow-2xl p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto sm:hidden mb-1 shrink-0" />
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm font-bold text-stone-900">Move Job Phase</h3>
                <p className="text-xs text-stone-500 truncate mt-0.5">
                  <span className="font-semibold text-stone-700">{mobileMoveJob.companyName}</span> · {mobileMoveJob.exactJobTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoveJob(null)}
                className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(
                [
                  { id: 'inbox', label: 'Inbox (New Leads)', icon: <InboxIcon className="w-4 h-4 text-stone-500" /> },
                  { id: 'saved', label: 'Shortlist (Saved for Application)', icon: <BookmarkIcon className="w-4 h-4 text-amber-600" /> },
                  { id: 'applied', label: 'Applied', icon: <CheckCircleIcon className="w-4 h-4 text-emerald-600" /> },
                  { id: 'interviewing', label: 'Interviewing', icon: <CalendarIcon className="w-4 h-4 text-purple-600" /> },
                  { id: 'archived', label: 'Archive / Rejected', icon: <ArchiveIcon className="w-4 h-4 text-stone-400" /> },
                ] as const
              ).map((phase) => {
                const isCurrent = mobileMoveJob.userStatus === phase.id;
                return (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => {
                      updateJobStatus(mobileMoveJob.id, phase.id as UserStatus);
                      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        try { navigator.vibrate([20, 30, 20]); } catch {}
                      }
                      setMobileMoveJob(null);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition active:scale-[0.98] ${
                      isCurrent
                        ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {phase.icon}
                      <span>{phase.label}</span>
                    </div>
                    {isCurrent && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Current</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
