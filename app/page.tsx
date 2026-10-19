'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UIMessage } from 'ai';
import type { User } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Project } from '@/lib/supabase/types';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  fetchCloudConversations,
  saveCloudConversation,
  deleteCloudConversation,
} from '@/lib/supabase/sync';
import { LeadAgentView } from '@/components/LeadAgentView';

interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: number;
  projectId?: string | null;
}

interface StoredDocItem {
  id: string;
  fileName: string;
  pageCount: number;
  fileSize: number;
  scope?: 'global' | 'chat';
  conversationId?: string;
}

interface CitationItem {
  fileName: string;
  pageNumber: number;
  displayName: string;
}

interface PreviewDrawerData {
  fileName: string;
  pageNumber: number;
  chunkText: string;
  confidenceLabel: string;
}

function IconFileText({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="9" x2="8" y2="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPaperclip({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGoogle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function IconApple({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.08 1.73-.95 2.76.99.08 2.04-.51 2.68-1.26z" />
    </svg>
  );
}

function IconFolder({ className = "h-4 w-4", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} stroke="currentColor" strokeWidth="1.8">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconImage({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDatabase({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7h8M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSparkles({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8">
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STORAGE_KEY = 'local-ai-conversations';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ');
}

function getTitle(messages: UIMessage[]): string {
  const firstMessage = messages.find(
    (message) => message.role === 'user',
  );

  if (!firstMessage) return 'New conversation';

  const text = getMessageText(firstMessage).trim();

  return text.length > 32
    ? `${text.slice(0, 32)}…`
    : text || 'Document conversation';
}

function formatNumber(value?: number): string {
  return value == null ? '0' : value.toLocaleString();
}

function createConversation(projectId?: string | null): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    messages: [],
    updatedAt: Date.now(),
    projectId: projectId || null,
  };
}

/**
 * Parses citations like [filename.pdf, Page 1] or [file.pdf, Page 2] from text
 */
function extractCitations(text: string): CitationItem[] {
  const citations: CitationItem[] = [];
  const regex = /\[([a-zA-Z0-9_\-.\s]+\.(?:pdf|png|jpe?g|webp|csv|md|txt)),?\s*Page\s*(\d+)\]/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fileName = match[1].trim();
    const pageNumber = parseInt(match[2], 10) || 1;
    if (!citations.some((c) => c.fileName === fileName && c.pageNumber === pageNumber)) {
      citations.push({
        fileName,
        pageNumber,
        displayName: fileName,
      });
    }
  }

  return citations;
}

/**
 * Sanitizes conversations before saving to localStorage:
 * Strips huge multi-megabyte base64 data URLs from file parts and replaces
 * them with lightweight API references (/api/pdf?fileName=...&raw=true).
 * This prevents browser QuotaExceededError.
 */
function sanitizeConversationsForStorage(convs: Conversation[]): Conversation[] {
  return convs.map((conv) => ({
    ...conv,
    messages: (conv.messages || []).map((msg) => ({
      ...msg,
      parts: (msg.parts || []).map((part: any) => {
        if (part.type === 'file' && typeof part.url === 'string') {
          if (part.url.startsWith('data:') || part.url.startsWith('blob:')) {
            return {
              ...part,
              url: part.filename
                ? `/api/pdf?fileName=${encodeURIComponent(part.filename)}&raw=true`
                : '',
            };
          }
        }
        return part;
      }),
    })),
  }));
}

function safeSaveConversations(convs: Conversation[]) {
  try {
    const sanitized = sanitizeConversationsForStorage(convs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      try {
        // Keep the 10 most recent conversations if quota is tight
        const pruned = sanitizeConversationsForStorage(convs.slice(0, 10));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      } catch (innerErr) {
        console.warn('Could not save conversation history due to browser quota limits:', innerErr);
      }
    } else {
      console.error('Could not save chat history:', err);
    }
  }
}

function ChatApp() {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'lead-agent'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rag_active_view');
      if (saved === 'lead-agent' || saved === 'chat') return saved;
    }
    return 'chat';
  });

  useEffect(() => {
    try {
      localStorage.setItem('rag_active_view', activeView);
    } catch {}
  }, [activeView]);

  // Knowledge base state
  const [documents, setDocuments] = useState<StoredDocItem[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalTab, setDocModalTab] = useState<'global' | 'chat'>('global');

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [stagedDocs, setStagedDocs] = useState<StoredDocItem[]>([]);

  // Citation preview drawer state
  const [previewDrawer, setPreviewDrawer] = useState<PreviewDrawerData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const activeIdRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const chatDocInputRef = useRef<HTMLInputElement>(null);

  // Supabase Client & Auth State
  const supabase = useRef(createClient()).current;
  const isCloudConfigured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#6366f1');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPrompt, setNewProjectPrompt] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    stop,
  } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  // Metrics generation stats (cleanly tracked without causing re-render loops)
  const [generationStats, setGenerationStats] = useState<{
    inputTokens: number;
    startTime: number;
    durationMs: number;
  }>({
    inputTokens: 0,
    startTime: 0,
    durationMs: 0,
  });

  const prevLoadingRef = useRef(false);
  useEffect(() => {
    // Only captures duration once when active streaming transitions to complete
    if (prevLoadingRef.current && !isLoading) {
      setGenerationStats((prev) => ({
        ...prev,
        durationMs: prev.startTime > 0 ? Date.now() - prev.startTime : prev.durationMs,
      }));
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/pdf');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const restoredRef = useRef(false);

  // Restore saved conversations once on initial mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = [...parsed].sort((a, b) => b.updatedAt - a.updatedAt);
          setConversations(sorted);
          setActiveId(sorted[0].id);
          activeIdRef.current = sorted[0].id;
          setMessages(sorted[0].messages ?? []);
          setReady(true);
          return;
        }
      }
    } catch (err) {
      console.error('Could not restore chat history:', err);
    }

    const initial = createConversation();
    setConversations([initial]);
    setActiveId(initial.id);
    activeIdRef.current = initial.id;
    setMessages([]);
    setReady(true);
  }, [setMessages]);

  // Initialize Supabase auth state & listener
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Sync projects and cloud conversations when user logs in
  useEffect(() => {
    if (!supabase || !user) return;

    fetchProjects(supabase).then((projs) => {
      setProjects(projs);
    });

    fetchCloudConversations(supabase).then((cloudConvs) => {
      setConversations((currentLocal) => {
        if (cloudConvs.length > 0) {
          const cloudIds = new Set(cloudConvs.map((c) => c.id));
          const mappedCloud: Conversation[] = cloudConvs.map((c) => ({
            id: c.id,
            title: c.title,
            messages: c.messages,
            updatedAt: c.updated_at,
            projectId: c.project_id,
          }));

          // Preserve and migrate any local conversations not yet saved to the cloud
          const unuploadedLocal = currentLocal.filter(
            (c) => !cloudIds.has(c.id) && (c.messages?.length > 0 || c.title !== 'New conversation')
          );
          unuploadedLocal.forEach((c) => {
            saveCloudConversation(supabase, c, c.projectId);
          });

          const merged = [...mappedCloud, ...unuploadedLocal].sort((a, b) => b.updatedAt - a.updatedAt);
          safeSaveConversations(merged);

          // Restore messages for the active conversation
          if (merged.length > 0) {
            setActiveId(merged[0].id);
            activeIdRef.current = merged[0].id;
            setMessages(merged[0].messages ?? []);
            if (merged[0].projectId) setActiveProjectId(merged[0].projectId);
          }
          return merged;
        } else if (currentLocal.length > 0) {
          // First time cloud sync: migrate existing local conversations to Supabase
          currentLocal
            .filter((c) => c.messages?.length > 0 || c.title !== 'New conversation')
            .forEach((c) => {
              saveCloudConversation(supabase, c, c.projectId);
            });
          return currentLocal;
        }
        return currentLocal;
      });
    });
  }, [supabase, user]);

  // Keep conversations updated and safely persisted when not streaming
  useEffect(() => {
    if (!ready || !activeId) return;
    // CRITICAL: Do NOT trigger conversation state updates or disk saves in the middle of active streaming
    if (isLoading) return;

    setConversations((previous) => {
      const existing = previous.find((conv) => conv.id === activeId);
      // Avoid re-rendering if this conversation's messages have not changed
      if (existing && existing.messages === messages) {
        return previous;
      }

      const current: Conversation = {
        id: activeId,
        title: getTitle(messages),
        messages,
        updatedAt: Date.now(),
        projectId: existing?.projectId ?? activeProjectId,
      };

      const updated = existing
        ? previous.map((conv) => (conv.id === activeId ? current : conv))
        : [current, ...previous];

      const sorted = updated.sort((a, b) => b.updatedAt - a.updatedAt);
      safeSaveConversations(sorted);

      if (supabase && user) {
        saveCloudConversation(supabase, current, current.projectId);
      }

      return sorted;
    });
  }, [messages, activeId, ready, isLoading, supabase, user, activeProjectId]);

  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 80;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottomBtn(!nearBottom && el.scrollHeight > el.clientHeight + 150);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
  }, []);

  useEffect(() => {
    // Only auto-scroll down if user is already at the bottom.
    // If user scrolled up to read earlier text, never hijack their scroll or cause flicker!
    if (isNearBottomRef.current) {
      const el = chatContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  useEffect(() => {
    function handleClickOutside() {
      setOpenProjectMenuId(null);
    }
    if (openProjectMenuId) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [openProjectMenuId]);

  const toggleProjectExpand = useCallback((projectId: string) => {
    setExpandedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  }, []);

  const openEditProject = useCallback((proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(proj);
    setNewProjectName(proj.name);
    setNewProjectDesc(proj.description || '');
    setNewProjectColor(proj.color || '#6366f1');
    setNewProjectPrompt(proj.custom_prompt || '');
    setProjectModalOpen(true);
  }, []);

  const startNewChat = useCallback((forProjectId?: string | null) => {
    if (isLoading) return;
    const targetProjId = forProjectId !== undefined ? forProjectId : null;
    const conversation = createConversation(targetProjId);
    activeIdRef.current = conversation.id;
    setActiveId(conversation.id);
    setActiveProjectId(targetProjId);
    setActiveView('chat');
    setMessages([]);
    setInput('');
    setSelectedImages([]);
    setImageError('');
    setSidebarOpen(false);
    setPreviewDrawer(null);
    setStagedDocs([]);
    setGenerationStats({
      inputTokens: 0,
      startTime: 0,
      durationMs: 0,
    });

    if (targetProjId) {
      setExpandedProjectIds((prev) =>
        prev.includes(targetProjId) ? prev : [...prev, targetProjId],
      );
    }

    setConversations((prev) => {
      const updated = [conversation, ...prev];
      safeSaveConversations(updated);
      return updated;
    });
    textareaRef.current?.focus();
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    requestAnimationFrame(() => scrollToBottom(false));
  }, [isLoading, setMessages, scrollToBottom]);

  const switchConversation = useCallback(
    (conversation: Conversation) => {
      if (isLoading) return;
      activeIdRef.current = conversation.id;
      setActiveId(conversation.id);
      setActiveView('chat');
      setMessages(conversation.messages ?? []);
      setInput('');
      setSelectedImages([]);
      setImageError('');
      setSidebarOpen(false);
      setPreviewDrawer(null);
      setStagedDocs([]);
      setGenerationStats({
        inputTokens: 0,
        startTime: 0,
        durationMs: 0,
      });

      if (conversation.projectId) {
        setActiveProjectId(conversation.projectId);
        setExpandedProjectIds((prev) =>
          prev.includes(conversation.projectId!) ? prev : [...prev, conversation.projectId!],
        );
      } else {
        setActiveProjectId(null);
      }
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      requestAnimationFrame(() => scrollToBottom(false));
    },
    [isLoading, setMessages, scrollToBottom],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (isLoading) return;
      if (supabase && user) {
        deleteCloudConversation(supabase, id);
      }
      const remaining = conversations.filter((c) => c.id !== id);
      if (id === activeId) {
        const next = remaining[0] ?? createConversation(activeProjectId);
        activeIdRef.current = next.id;
        setActiveId(next.id);
        setMessages(next.messages ?? []);
        const nextConvs = remaining.length === 0 ? [next] : remaining;
        setConversations(nextConvs);
        safeSaveConversations(nextConvs);
      } else {
        setConversations(remaining);
        safeSaveConversations(remaining);
      }
    },
    [activeId, conversations, isLoading, setMessages, supabase, user, activeProjectId],
  );

  async function signInWithGoogle() {
    if (!supabase) {
      setAuthError('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  }

  async function signInWithApple() {
    if (!supabase) {
      setAuthError('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  async function handleCreateProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    if (editingProject) {
      if (supabase && user) {
        await updateProject(supabase, editingProject.id, {
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          color: newProjectColor,
          custom_prompt: newProjectPrompt.trim(),
        });
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                name: newProjectName.trim(),
                description: newProjectDesc.trim(),
                color: newProjectColor,
                custom_prompt: newProjectPrompt.trim(),
                updated_at: new Date().toISOString(),
              }
            : p,
        ),
      );
      setEditingProject(null);
    } else {
      let created: Project | null = null;
      if (supabase && user) {
        created = await createProject(
          supabase,
          newProjectName,
          newProjectDesc,
          newProjectColor,
          newProjectPrompt,
        );
      }
      
      if (!created) {
        created = {
          id: crypto.randomUUID(),
          user_id: user?.id || 'local',
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          color: newProjectColor,
          custom_prompt: newProjectPrompt.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      setProjects((prev) => [created!, ...prev]);
      setActiveProjectId(created.id);
      setExpandedProjectIds((prev) => [...prev, created!.id]);
    }

    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectPrompt('');
    setCreatingProject(false);
    setProjectModalOpen(false);
  }

  async function handleDeleteProjectSubmit(projectId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    if (supabase && user) {
      await deleteProject(supabase, projectId);
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  }

  async function processFileUpload(file: File, scope: 'global' | 'chat' = 'chat') {
    setUploadingDoc(true);
    setUploadStatus(`Indexing ${file.name} (${scope === 'global' ? 'Global' : 'This Chat'})...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scope', scope);
      if (scope === 'chat' && activeId) {
        formData.append('conversationId', activeId);
      }

      const res = await fetch('/api/pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadStatus(`Error: ${data.error || 'Failed to upload'}`);
      } else {
        setUploadStatus(`Indexed: ${data.filename} (${data.pages}p, ${data.chunksCount} chunks)`);
        await fetchDocuments();
        if (scope === 'chat' && data.filename) {
          setStagedDocs((prev) => [
            ...prev.filter((d) => d.fileName !== data.filename),
            {
              id: data.filename,
              fileName: data.filename,
              pageCount: data.pages || 1,
              fileSize: data.size || 0,
              scope: 'chat',
              conversationId: activeIdRef.current,
            },
          ]);
        }
        setTimeout(() => setUploadStatus(''), 4500);
      }
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message || 'Network error'}`);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDocUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      await processFileUpload(file, 'global');
    }
  }

  async function handleChatDocUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      setStagedFiles((prev) => [...prev.filter((f) => f.name !== file.name), file]);
      await processFileUpload(file, 'chat');
    }
  }

  async function handleDeleteDocument(fileName: string) {
    if (!confirm(`Remove "${fileName}" from Knowledge Base?`)) return;

    try {
      const res = await fetch(`/api/pdf?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchDocuments();
        if (previewDrawer?.fileName === fileName) {
          setPreviewDrawer(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  }

  // Open Citation preview drawer
  async function openCitationPreview(citation: CitationItem) {
    setLoadingPreview(true);
    setPreviewDrawer({
      fileName: citation.fileName,
      pageNumber: citation.pageNumber,
      chunkText: 'Loading extracted passage...',
      confidenceLabel: 'Verified Reference',
    });

    try {
      const res = await fetch(`/api/pdf?fileName=${encodeURIComponent(citation.fileName)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.chunks) && data.chunks.length > 0) {
          const matchingChunk =
            data.chunks.find((c: any) => c.pageNumber === citation.pageNumber) ||
            data.chunks[0];

          setPreviewDrawer({
            fileName: citation.fileName,
            pageNumber: citation.pageNumber,
            chunkText: matchingChunk.content,
            confidenceLabel: 'Verified Grounded Passage',
          });
        } else {
          setPreviewDrawer((prev) =>
            prev ? { ...prev, chunkText: 'Passage text temporarily unavailable.' } : null,
          );
        }
      }
    } catch {
      setPreviewDrawer((prev) =>
        prev ? { ...prev, chunkText: 'Could not load passage from store.' } : null,
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  // Drag and Drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const isSidebar = Boolean((e.target as HTMLElement).closest('aside'));
    if (!isSidebar) {
      setStagedFiles((prev) => [...prev.filter((f) => f.name !== file.name), file]);
    }
    await processFileUpload(file, isSidebar ? 'global' : 'chat');
  }

  function handleImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setImageError('');
    const validFiles: File[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setImageError(`${file.name}: format not supported. Use JPG, PNG, or WebP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setImageError(`${file.name}: file exceeds 10 MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const toAdd = validFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...toAdd];
    });

    for (const file of validFiles) {
      processFileUpload(file, 'chat');
    }
  }

  function removeStagedFile(fileName: string) {
    setStagedFiles((prev) => prev.filter((f) => f.name !== fileName));
    setStagedDocs((prev) => prev.filter((d) => d.fileName !== fileName));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if ((!text && stagedFiles.length === 0) || isLoading || !ready) return;

    const filesToSend = [...stagedFiles];
    setInput('');
    setStagedFiles([]);
    setSelectedImages([]);
    setStagedDocs([]);
    setImageError('');


    // Estimate input tokens (prompt text + active document context + chat history)
    const contextEstimate = documents.length > 0 ? 1200 : 200;
    const estInput = Math.max(50, Math.ceil(text.length / 3.8) + contextEstimate);
    setGenerationStats({
      inputTokens: estInput,
      startTime: Date.now(),
      durationMs: 0,
    });

    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const fileList = new DataTransfer();
      filesToSend.forEach((file) => fileList.items.add(file));

      const currentConv = conversations.find((c) => c.id === activeId);
      const currentProj = projects.find((p) => p.id === currentConv?.projectId);

      await sendMessage(
        {
          text: text || (filesToSend.length > 0 ? `Please analyze and summarize the attached document (${filesToSend.map((f) => f.name).join(', ')}).` : ''),
          files: fileList.files,
        },
        {
          body: {
            conversationId: activeId,
            customPrompt: currentProj?.custom_prompt,
          },
        },
      );
    } catch (err) {
      console.error('Could not send message:', err);
      setImageError('Message failed to send. Check that Ollama is running.');
    }
  }

  const globalDocs = documents.filter((d) => !d.scope || d.scope === 'global');
  const chatDocs = documents.filter((d) => d.scope === 'chat' && d.conversationId === activeId);
  const activeChatDoc = chatDocs[0];

  // Derived Token Metrics (Calculated on the fly without state update loops!)
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');

  const assistantText = lastAssistantMsg ? getMessageText(lastAssistantMsg) : '';
  const userText = lastUserMsg ? getMessageText(lastUserMsg) : '';

  const displayOutputTokens = assistantText ? Math.max(1, Math.ceil(assistantText.length / 3.8)) : 0;

  const displayInputTokens = generationStats.inputTokens > 0
    ? generationStats.inputTokens
    : (userText ? Math.max(50, Math.ceil(userText.length / 3.8) + (documents.length > 0 ? 1200 : 200)) : 0);

  const durationMs = generationStats.durationMs > 0
    ? generationStats.durationMs
    : (isLoading && generationStats.startTime > 0 ? Math.max(100, Date.now() - generationStats.startTime) : 0);

  const tokensPerSecond = durationMs > 0 && displayOutputTokens > 0
    ? Number((displayOutputTokens / (durationMs / 1000)).toFixed(1))
    : 0;

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-dvh overflow-hidden bg-[#f7f5f0] font-sans text-stone-900"
    >
      {/* Drag & Drop Visual Backdrop */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#f7f5f0]/90 backdrop-blur-md transition">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-indigo-400 bg-[#fdfcf9] p-10 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <IconFileText className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-medium text-stone-900">Drop your document or image here</h3>
            <p className="max-w-xs text-xs text-stone-500">
              PDFs, images, or markdown files will be extracted, chunked, and indexed into your local RAG store.
            </p>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-stone-900/30 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Minimalist Warm Light Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-[#e2dfd7] bg-[#eeece5] transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#e2dfd7] px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-stone-900 text-white shadow-2xs">
              <svg viewBox="0 0 32 32" className="h-4 w-4" fill="none">
                <line x1="11" y1="6" x2="11" y2="26" stroke="#fdfcf9" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M11 6.5L19 11.5L11 16.5" fill="none" stroke="#fdfcf9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="11.5" y1="16.5" x2="20" y2="25.5" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="22" cy="7" r="1.5" fill="#f59e0b" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-semibold tracking-tight text-stone-900 leading-tight lowercase">
                  rune
                </span>
                <span className="rounded bg-amber-100/70 px-1 py-0.2 text-[9px] font-medium text-amber-800">
                  ai
                </span>
              </div>
              <span className="text-[10px] text-stone-500 font-medium leading-none">
                document intelligence
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-[#ded9cf]/60 hover:text-stone-800 md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => startNewChat()}
            disabled={isLoading || !ready}
            className="flex w-full items-center justify-between rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-3.5 py-2.5 text-sm text-stone-800 shadow-2xs transition hover:border-[#cfc9be] hover:bg-white disabled:opacity-40"
          >
            <span className="font-medium">New chat</span>
            <span className="text-xs text-stone-400">⌘K</span>
          </button>
        </div>

        {/* Unified Scrollable Sidebar: Projects with Nested Chats + Conversations */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-3">
          {/* LEAD AGENT SHORTCUT */}
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveView('lead-agent');
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                activeView === 'lead-agent'
                  ? 'bg-[#ded9cf] text-stone-900 font-semibold shadow-2xs'
                  : 'text-stone-700 hover:bg-[#ded9cf]/60 hover:text-stone-900 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800">
                  ⚡
                </span>
                <span className="font-medium text-[13px]">Lead Agent</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </button>
          </div>

          {/* PROJECTS SECTION */}
          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Projects
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingProject(null);
                  setNewProjectName('');
                  setNewProjectDesc('');
                  setNewProjectPrompt('');
                  setNewProjectColor('#6366f1');
                  setProjectModalOpen(true);
                }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-[#ded9cf]/60 text-stone-500 hover:text-stone-800 transition"
                title="Create new project"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setNewProjectName('');
                    setNewProjectDesc('');
                    setNewProjectPrompt('');
                    setNewProjectColor('#6366f1');
                    setProjectModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition text-left"
                >
                  <span className="text-sm">+</span>
                  <span>Create your first project</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((proj) => {
                  const isExpanded = expandedProjectIds.includes(proj.id);
                  const projectConvs = conversations.filter((c) => c.projectId === proj.id);
                  const hasActiveChat = projectConvs.some((c) => c.id === activeId);
                  const isMenuOpen = openProjectMenuId === proj.id;

                  return (
                    <div key={proj.id} className="relative space-y-0.5">
                      {/* Project Folder Row */}
                      <div
                        className={`group flex items-center justify-between rounded-xl px-2 py-1.5 text-xs transition cursor-pointer select-none ${
                          hasActiveChat || activeProjectId === proj.id
                            ? 'bg-[#ded9cf]/70 text-stone-900 font-medium'
                            : 'text-stone-700 hover:bg-[#ded9cf]/40 hover:text-stone-900'
                        }`}
                        onClick={() => toggleProjectExpand(proj.id)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProjectExpand(proj.id);
                            }}
                            className="p-0.5 text-stone-400 hover:text-stone-700 transition"
                            title={isExpanded ? 'Collapse project' : 'Expand project'}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              className={`h-3 w-3 transition-transform duration-150 ${
                                isExpanded ? 'rotate-90 text-stone-700' : 'text-stone-400'
                              }`}
                              stroke="currentColor"
                              strokeWidth="2.2"
                            >
                              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>

                          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                            <IconFolder
                              className="h-4 w-4 shrink-0"
                              style={{ color: proj.color || '#6366f1' }}
                            />
                            <span className="truncate">{proj.name}</span>
                          </div>
                        </div>

                        {/* Project Actions on Hover */}
                        <div className="flex items-center gap-0.5">
                          {/* New chat in this project button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startNewChat(proj.id);
                            }}
                            title={`New chat in ${proj.name}`}
                            className="hidden h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-[#ded9cf] hover:text-stone-800 transition group-hover:flex"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.2">
                              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                            </svg>
                          </button>

                          {/* More Options / Popover Menu button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenProjectMenuId(isMenuOpen ? null : proj.id);
                            }}
                            title="Project options"
                            className={`h-5 w-5 items-center justify-center rounded transition ${
                              isMenuOpen
                                ? 'flex bg-[#ded9cf] text-stone-800'
                                : 'hidden text-stone-400 hover:bg-[#ded9cf] hover:text-stone-800 group-hover:flex'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="6" cy="12" r="1.5" />
                              <circle cx="18" cy="12" r="1.5" />
                            </svg>
                          </button>

                          {/* Chat count badge (shown when not hovering and menu not open) */}
                          {!isMenuOpen && (
                            <span className="text-[10px] text-stone-400 px-1 group-hover:hidden">
                              {projectConvs.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Popover Menu (matching ChatGPT project menu) */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-8 z-50 w-44 rounded-2xl border border-[#ded9cf] bg-[#fdfcf9] p-1.5 shadow-xl text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              setOpenProjectMenuId(null);
                              openEditProject(proj, e);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-stone-700 hover:bg-[#ded9cf]/50 transition text-left"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-stone-500" stroke="currentColor" strokeWidth="1.8">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Project settings</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenProjectMenuId(null);
                              startNewChat(proj.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-stone-700 hover:bg-[#ded9cf]/50 transition text-left"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-stone-500" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                            </svg>
                            <span>New chat</span>
                          </button>

                          <div className="border-t border-[#eeece5] my-1" />

                          <button
                            type="button"
                            onClick={(e) => {
                              setOpenProjectMenuId(null);
                              handleDeleteProjectSubmit(proj.id, e);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-red-600 hover:bg-red-50 transition text-left"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-red-500" stroke="currentColor" strokeWidth="1.8">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Delete project</span>
                          </button>
                        </div>
                      )}

                      {/* Nested Project Chats (clean indentation like ChatGPT) */}
                      {isExpanded && (
                        <div className="pl-6 pr-1 space-y-0.5 mt-0.5 mb-1.5">
                          {projectConvs.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => startNewChat(proj.id)}
                              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-stone-400 hover:bg-[#ded9cf]/40 hover:text-stone-700 transition"
                            >
                              <span className="text-xs">+</span>
                              <span>New chat in {proj.name}</span>
                            </button>
                          ) : (
                            <>
                              {projectConvs.map((conversation) => {
                                const active = conversation.id === activeId;
                                return (
                                  <div
                                    key={conversation.id}
                                    className={`group flex items-center justify-between rounded-xl transition ${
                                      active
                                        ? 'bg-[#ded9cf]/80 text-stone-900 font-medium shadow-2xs'
                                        : 'text-stone-600 hover:bg-[#ded9cf]/40 hover:text-stone-900'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => switchConversation(conversation)}
                                      disabled={isLoading}
                                      title={conversation.title}
                                      className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[12.5px] disabled:cursor-not-allowed"
                                    >
                                      <span className="block truncate">{conversation.title}</span>
                                    </button>

                                    <button
                                      type="button"
                                      aria-label={`Delete ${conversation.title}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteConversation(conversation.id);
                                      }}
                                      disabled={isLoading}
                                      className="mr-1 rounded p-1 text-stone-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                                    >
                                      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.8">
                                        <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                  </div>
                                );
                              })}

                              {/* Button to quickly add another chat to this project */}
                              <button
                                type="button"
                                onClick={() => startNewChat(proj.id)}
                                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] text-stone-400 hover:bg-[#ded9cf]/40 hover:text-stone-700 transition"
                              >
                                <span className="text-xs">+</span>
                                <span>New chat</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CONVERSATIONS SECTION (Standalone chats not assigned to a project) */}
          <div className="border-t border-[#e2dfd7] pt-3">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Conversations
              </span>
              <button
                type="button"
                onClick={() => startNewChat()}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-[#ded9cf]/60 text-stone-500 hover:text-stone-800 transition"
                title="New conversation"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {conversations.filter((c) => !c.projectId).length === 0 ? (
              <p className="px-2 py-2 text-xs text-stone-400">
                Your standalone conversations will appear here.
              </p>
            ) : (
              <div className="space-y-0.5">
                {conversations
                  .filter((c) => !c.projectId)
                  .map((conversation) => {
                    const active = conversation.id === activeId;
                    return (
                      <div
                        key={conversation.id}
                        className={`group flex items-center justify-between rounded-xl transition ${
                          active
                            ? 'bg-[#ded9cf]/90 text-stone-900 font-medium shadow-2xs'
                            : 'text-stone-600 hover:bg-[#ded9cf]/40 hover:text-stone-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => switchConversation(conversation)}
                          disabled={isLoading}
                          title={conversation.title}
                          className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[13px] disabled:cursor-not-allowed"
                        >
                          <span className="block truncate">{conversation.title}</span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Delete ${conversation.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          disabled={isLoading}
                          className="mr-1.5 rounded p-1 text-stone-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        >
                          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.6">
                            <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer with User Profile / Login & Knowledge Base */}
        <div className="border-t border-[#e2dfd7] p-3 space-y-2">
          {/* User Profile / Auth State */}
          {user ? (
            <div className="flex items-center justify-between rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-2.5 py-1.5 text-xs shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User"
                    className="h-6 w-6 rounded-full object-cover border border-[#ded9cf]"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-800 text-[11px]">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="truncate text-[9px] text-stone-400">
                    Synced with Cloud
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-stone-400 hover:text-stone-700 hover:bg-[#eeece5] transition shrink-0"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-3 py-2 text-xs text-stone-700 shadow-2xs transition hover:border-[#cfc9be] hover:bg-white hover:text-stone-900"
            >
              <div className="flex items-center gap-2">
                <IconGoogle className="h-4 w-4" />
                <span className="font-medium">Sign in to Sync</span>
              </div>
              <span className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[10px] font-medium">
                Cloud
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDocModalOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-3 py-2 text-xs text-stone-700 shadow-2xs transition hover:border-[#cfc9be] hover:bg-white hover:text-stone-900"
          >
            <div className="flex items-center gap-2">
              <IconDatabase className="h-4 w-4 text-stone-600" />
              <span className="font-medium">Knowledge Base</span>
            </div>
            <span className="rounded bg-[#eeece5] px-1.5 py-0.5 text-[10px] font-medium text-stone-700">
              {documents.length}
            </span>
          </button>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-medium text-stone-600">
                Qwen 2.5 · Local Ollama
              </span>
            </div>
            {user && (
              <span className="text-[10px] font-medium text-emerald-600">
                ☁️ Synced
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content: Lead Agent vs Chat Area */}
      {activeView === 'lead-agent' ? (
        <section className="relative flex min-w-0 flex-1 flex-col bg-[#fdfcf9]">
          <LeadAgentView
            onBackToChat={() => setActiveView('chat')}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        </section>
      ) : (
        <section className="relative flex min-w-0 flex-1 flex-col bg-[#f7f5f0]">
        {/* Minimalist Warm Light Top Navigation Bar */}
        <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b border-[#e2dfd7] bg-[#f7f5f0]/85 px-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-stone-600 hover:bg-[#eeece5] hover:text-stone-900 md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('lead-agent')}
              className="flex md:hidden items-center gap-1.5 rounded-xl border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-2xs"
            >
              <span>⚡</span>
              <span>Jobs</span>
            </button>

            {/* Current Project Pill (if any) */}
            {(() => {
              const currentConv = conversations.find((c) => c.id === activeId);
              const currentProj = projects.find((p) => p.id === currentConv?.projectId);
              if (!currentProj) return null;
              return (
                <div
                  onClick={(e) => openEditProject(currentProj, e)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ded9cf] bg-[#fdfcf9] px-2.5 py-1.5 text-xs text-stone-800 shadow-2xs hover:border-[#cfc9be] hover:bg-white transition"
                  title={`Project: ${currentProj.name}${currentProj.custom_prompt ? ' (Custom instructions active)' : ''}. Click to edit settings.`}
                >
                  <IconFolder
                    className="h-4 w-4 shrink-0"
                    style={{ color: currentProj.color || '#6366f1' }}
                  />
                  <span className="max-w-[120px] sm:max-w-[180px] truncate font-medium">{currentProj.name}</span>
                </div>
              );
            })()}
          </div>

          {/* Live Working Token Metrics Counter */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-[#ded9cf] bg-[#eeece5] px-2.5 py-1.5 shadow-2xs">
              <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <div className="text-[11px] font-medium text-stone-600">
                <span>In: {formatNumber(displayInputTokens)}</span>
                <span className="mx-1 sm:mx-1.5 text-stone-300">|</span>
                <span>Out: {formatNumber(displayOutputTokens)}</span>
                {tokensPerSecond > 0 && (
                  <span className="hidden sm:inline">
                    <span className="mx-1.5 text-stone-300">|</span>
                    <span className="text-emerald-600 font-medium">{tokensPerSecond} tok/s</span>
                  </span>
                )}
                {durationMs > 0 && (
                  <span className="hidden sm:inline">
                    <span className="mx-1.5 text-stone-300">|</span>
                    <span>{(durationMs / 1000).toFixed(1)}s</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Message Thread */}
        <div
          ref={chatContainerRef}
          onScroll={handleChatScroll}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 sm:px-8">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center pb-12">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ded9cf] bg-[#fdfcf9] text-stone-700 shadow-2xs">
                  <IconSparkles className="h-7 w-7 text-stone-700" />
                </div>

                <h2 className="text-center text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                  RAG Document Assistant
                </h2>

                <p className="mt-2 text-center text-sm text-stone-500">
                  Ask questions about your uploaded PDFs, images, or documentation.
                </p>

                <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {(activeChatDoc
                    ? [
                        `Summarize ${activeChatDoc.fileName}`,
                        'What are the key points in this document?',
                        'Extract important facts and data',
                        'Explain the core conclusions',
                      ]
                    : [
                        'Summarize documents in knowledge base',
                        'Search across all indexed files',
                        'Extract key insights and summaries',
                        'Ask questions about your documents',
                      ]
                  ).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-2xl border border-[#ded9cf] bg-[#fdfcf9] p-3.5 text-left text-xs text-stone-700 shadow-2xs transition hover:border-[#cfc9be] hover:bg-white hover:text-stone-900"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-8">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const citations = !isUser
                    ? extractCitations(getMessageText(message))
                    : [];

                  return (
                    <div
                      key={message.id}
                      className={`flex w-full gap-3 sm:gap-4 ${
                        isUser ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {!isUser && (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#ded9cf] bg-[#eeece5] text-xs font-semibold text-stone-700">
                          AI
                        </div>
                      )}

                      <div
                        className={`min-w-0 ${
                          isUser
                            ? 'max-w-[85%] rounded-2xl bg-[#eae6dc] border border-[#dbd6ca] px-4 py-2.5 text-sm text-stone-900 shadow-2xs sm:max-w-[75%]'
                            : 'flex-1 pt-1'
                        }`}
                      >
                        {!isUser && (
                          <p className="mb-1.5 text-xs font-semibold text-stone-400">
                            Qwen 2.5
                          </p>
                        )}

                        {isUser ? (
                          <div className="text-sm leading-relaxed text-stone-900 font-normal">
                            {/* Render File Attachment Cards first */}
                            {message.parts
                              .filter((p) => p.type === 'file')
                              .map((part, index) => {
                                const filename = part.filename || 'Attachment';
                                const lowerName = filename.toLowerCase();
                                const isImage =
                                  part.mediaType?.startsWith('image/') ||
                                  /\.(png|jpe?g|webp|gif)$/i.test(lowerName);
                                const isPdf =
                                  part.mediaType === 'application/pdf' ||
                                  lowerName.endsWith('.pdf');
                                const isDocx =
                                  lowerName.endsWith('.docx') ||
                                  lowerName.endsWith('.doc') ||
                                  part.mediaType?.includes('word');

                                if (isImage) {
                                  return (
                                    <div
                                      key={`file-${index}`}
                                      className="my-2 max-w-[220px] overflow-hidden rounded-xl border border-stone-300/80 bg-[#fdfcf9] shadow-2xs transition hover:border-stone-400"
                                    >
                                      <img
                                        src={part.url}
                                        alt={filename}
                                        onClick={() => {
                                          window.open(part.url || `/api/pdf?fileName=${encodeURIComponent(filename)}&raw=true`, '_blank');
                                        }}
                                        title="Click to view full size"
                                        onError={(e) => {
                                          e.currentTarget.src = `/api/pdf?fileName=${encodeURIComponent(filename)}&raw=true`;
                                        }}
                                        className="max-h-36 w-full cursor-pointer rounded-t-xl object-contain bg-stone-100/40 hover:opacity-95"
                                      />
                                      <div className="flex items-center justify-between border-t border-stone-200/80 bg-stone-100/70 px-2.5 py-1 text-[11px] text-stone-600">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <IconImage className="h-3 w-3 text-stone-500 shrink-0" />
                                          <span className="truncate font-medium">{filename}</span>
                                        </div>
                                        <span className="rounded bg-stone-200/70 px-1 py-0.2 text-[9px] font-semibold uppercase text-stone-700">
                                          IMAGE
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }

                                if (isPdf) {
                                  return (
                                    <div
                                      key={`file-${index}`}
                                      onClick={() =>
                                        openCitationPreview({
                                          fileName: filename,
                                          pageNumber: 1,
                                          displayName: filename,
                                        })
                                      }
                                      className="my-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-red-200/90 bg-[#fdfcf9] p-3 shadow-2xs transition hover:border-red-300 hover:bg-white"
                                    >
                                      <div className="flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-red-600 text-white shadow-2xs">
                                        <span className="text-[10px] font-black tracking-tight">PDF</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-stone-900">
                                          {filename}
                                        </p>
                                        <p className="text-[10px] text-stone-500">
                                          PDF Document • Click to preview chunks
                                        </p>
                                      </div>
                                      <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                        PDF
                                      </span>
                                    </div>
                                  );
                                }

                                if (isDocx) {
                                  return (
                                    <div
                                      key={`file-${index}`}
                                      onClick={() =>
                                        openCitationPreview({
                                          fileName: filename,
                                          pageNumber: 1,
                                          displayName: filename,
                                        })
                                      }
                                      className="my-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-blue-200/90 bg-[#fdfcf9] p-3 shadow-2xs transition hover:border-blue-300 hover:bg-white"
                                    >
                                      <div className="flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                                        <span className="text-[8px] font-black tracking-tight">DOCX</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-stone-900">
                                          {filename}
                                        </p>
                                        <p className="text-[10px] text-stone-500">
                                          Word Document • Click to preview chunks
                                        </p>
                                      </div>
                                      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                        DOCX
                                      </span>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={`file-${index}`}
                                    onClick={() =>
                                      openCitationPreview({
                                        fileName: filename,
                                        pageNumber: 1,
                                        displayName: filename,
                                      })
                                    }
                                    className="my-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 bg-[#fdfcf9] p-3 shadow-2xs transition hover:border-stone-300 hover:bg-white"
                                  >
                                    <div className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-700 text-white shadow-2xs">
                                      <IconFileText className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-stone-900">
                                        {filename}
                                      </p>
                                      <p className="text-[10px] text-stone-500">
                                        Document File • Click to preview chunks
                                      </p>
                                    </div>
                                    <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                                      FILE
                                    </span>
                                  </div>
                                );
                              })}

                            {/* Render Text Content */}
                            {message.parts
                              .filter((p) => p.type === 'text')
                              .map((part, index) => {
                                if (!part.text?.trim()) return null;
                                return (
                                  <p key={`text-${index}`} className="whitespace-pre-wrap leading-relaxed">
                                    {part.text}
                                  </p>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="markdown-content text-sm leading-7 text-zinc-800">
                            {message.parts.map((part, index) => {
                              if (part.type === 'text') {
                                return (
                                  <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                                    {part.text}
                                  </ReactMarkdown>
                                );
                              }

                              if (
                                part.type === 'file' &&
                                part.mediaType?.startsWith('image/')
                              ) {
                                return (
                                  <div key={index} className="my-2 max-w-[240px] overflow-hidden rounded-xl border border-stone-200">
                                    <img
                                      src={part.url}
                                      alt={part.filename || 'Attached image'}
                                      className="max-h-36 w-full rounded-xl object-contain shadow-xs"
                                    />
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>
                        )}

                        {/* Interactive Citations Badges */}
                        {!isUser && citations.length > 0 && (
                          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-zinc-200/70 pt-2.5">
                            <span className="text-[11px] font-medium text-zinc-400">
                              Verified Sources:
                            </span>
                            {citations.map((cite, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => openCitationPreview(cite)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs text-indigo-700 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-100"
                              >
                                <IconFileText className="h-3.5 w-3.5 text-indigo-600" />
                                <span className="font-medium">{cite.displayName}</span>
                                <span className="rounded bg-indigo-100 px-1 text-[10px] text-indigo-800">
                                  Page {cite.pageNumber}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-2.5 pl-10">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400 [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-stone-400">Thinking & grounding answer…</span>
                  </div>
                )}

                {error && (
                  <p className="ml-10 text-sm text-red-500">
                    Could not connect to Ollama. Check that Ollama is running, then try again.
                  </p>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Scroll To Bottom Floating Button (appears when user scrolled up) */}
        {showScrollBottomBtn && (
          <div className="pointer-events-none sticky bottom-3 z-20 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#ded9cf] bg-[#fdfcf9] px-3.5 py-1.5 text-xs font-medium text-stone-700 shadow-md hover:border-stone-400 hover:bg-white hover:text-stone-900 transition animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-stone-500" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Scroll to bottom</span>
            </button>
          </div>
        )}

        {/* Message Composer */}
        <div className="shrink-0 px-3 pb-4 pt-2 sm:px-8 sm:pb-6">
          <div className="mx-auto max-w-3xl">
            {stagedFiles.length > 0 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                {stagedFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/');
                  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
                  const isDocx = file.name.endsWith('.docx') || file.name.endsWith('.doc');

                  if (isImage) {
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="group relative flex items-center gap-2 rounded-xl border border-stone-300 bg-[#fdfcf9] p-1.5 shadow-2xs"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                        <div className="max-w-[140px] pr-2">
                          <p className="truncate text-xs font-medium text-stone-800">{file.name}</p>
                          <p className="text-[10px] text-stone-500">{(file.size / 1024).toFixed(0)} KB • Ready</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => removeStagedFile(file.name)}
                          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-700 text-[9px] text-white shadow-xs hover:bg-stone-900"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  }

                  if (isPdf) {
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="relative flex items-center gap-2.5 rounded-xl border border-red-200 bg-[#fdfcf9] px-2.5 py-1.5 shadow-2xs"
                      >
                        <div className="flex h-8 w-7 items-center justify-center rounded bg-red-600 text-white font-bold text-[9px]">
                          PDF
                        </div>
                        <div className="max-w-[160px] pr-1">
                          <p className="truncate text-xs font-semibold text-stone-900">{file.name}</p>
                          <p className="text-[10px] text-stone-500">{(file.size / 1024).toFixed(0)} KB • Ready</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove document"
                          onClick={() => removeStagedFile(file.name)}
                          className="text-stone-400 hover:text-red-500 ml-1 font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  }

                  if (isDocx) {
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="relative flex items-center gap-2.5 rounded-xl border border-blue-200 bg-[#fdfcf9] px-2.5 py-1.5 shadow-2xs"
                      >
                        <div className="flex h-8 w-7 items-center justify-center rounded bg-blue-600 text-white font-bold text-[8px]">
                          DOCX
                        </div>
                        <div className="max-w-[160px] pr-1">
                          <p className="truncate text-xs font-semibold text-stone-900">{file.name}</p>
                          <p className="text-[10px] text-stone-500">{(file.size / 1024).toFixed(0)} KB • Ready</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove document"
                          onClick={() => removeStagedFile(file.name)}
                          className="text-stone-400 hover:text-red-500 ml-1 font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className="relative flex items-center gap-2.5 rounded-xl border border-stone-200 bg-[#fdfcf9] px-2.5 py-1.5 shadow-2xs"
                    >
                      <div className="flex h-8 w-7 items-center justify-center rounded bg-stone-700 text-white font-bold text-[8px]">
                        FILE
                      </div>
                      <div className="max-w-[160px] pr-1">
                        <p className="truncate text-xs font-semibold text-stone-900">{file.name}</p>
                        <p className="text-[10px] text-stone-500">{(file.size / 1024).toFixed(0)} KB • Ready</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove document"
                        onClick={() => removeStagedFile(file.name)}
                        className="text-stone-400 hover:text-red-500 ml-1 font-bold text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {imageError && (
              <p className="mb-2 text-xs text-red-500">{imageError}</p>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[#ded9cf] bg-[#fdfcf9] p-2 shadow-[0_4px_24px_rgba(40,35,30,0.06)] transition focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-stone-900/5"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  stagedFiles.length > 0
                    ? `Ask about ${stagedFiles[0].name}...`
                    : messages.length === 0
                      ? 'Ask a question or drop a document to search...'
                      : 'Ask a follow-up or search your documents...'
                }
                rows={1}
                disabled={!ready}
                className="max-h-36 min-h-12 w-full resize-y bg-transparent px-3 py-2.5 text-sm text-stone-900 outline-none placeholder:text-stone-400"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleImageSelection}
                className="hidden"
              />

              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.docx,.doc"
                onChange={handleDocUpload}
                className="hidden"
              />

              <input
                ref={chatDocInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.docx,.doc"
                onChange={handleChatDocUpload}
                className="hidden"
              />

              <div className="flex items-center justify-between px-1.5 pb-1 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Attach document to this chat (PDF, Images, Word DOCX, CSV)"
                    aria-label="Attach document to chat"
                    disabled={!ready || isLoading || uploadingDoc}
                    onClick={() => chatDocInputRef.current?.click()}
                    className="flex h-8 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-2.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-30"
                  >
                    <IconPaperclip className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Attach Doc</span>
                  </button>

                  <button
                    type="button"
                    title="Attach images for OCR"
                    aria-label="Attach images"
                    disabled={!ready || isLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-500 transition hover:bg-[#eeece5] hover:text-stone-900 disabled:opacity-30"
                  >
                    <IconImage className="h-4 w-4 text-stone-600" />
                  </button>

                  <span className="hidden text-xs text-stone-400 sm:inline">
                    {uploadingDoc ? uploadStatus : 'Drop files to attach to this chat'}
                  </span>
                </div>

                {isLoading ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    title="Stop generation"
                    aria-label="Stop generation"
                    className="flex h-8 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-600 shadow-2xs transition hover:bg-red-100"
                  >
                    <span className="h-2 w-2 rounded-2xs bg-red-600" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={(!input.trim() && stagedFiles.length === 0) || !ready}
                    aria-label="Send message"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 text-white shadow-2xs transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-[#eeece5] disabled:text-stone-400"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>
      )}

      {/* Slide-out Document Citation & Passage Preview Drawer */}
      {previewDrawer && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white p-5 shadow-2xl sm:w-[420px]">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                {previewDrawer.confidenceLabel}
              </span>
              <h3 className="truncate text-sm font-semibold text-zinc-900">
                {previewDrawer.fileName}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setPreviewDrawer(null)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Source Page: {previewDrawer.pageNumber}</span>
            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Indexed Vector Chunk
            </span>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-800">
            {loadingPreview ? (
              <p className="text-zinc-400">Loading original chunk text…</p>
            ) : (
              <p className="whitespace-pre-wrap">{previewDrawer.chunkText}</p>
            )}
          </div>

          <div className="mt-4 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
            This passage was retrieved via cosine similarity and supplied to Qwen 2.5 to ground its answer.
          </div>
        </aside>
      )}

      {/* Knowledge Base & Document Manager Modal */}
      {docModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 sm:px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                  <IconDatabase className="h-4 w-4 text-zinc-800" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Document Knowledge Base</h2>
                  <p className="text-xs text-zinc-500">Manage your local vector store documents & chat attachments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDocModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex overflow-x-auto scrollbar-none border-b border-zinc-100 px-4 sm:px-6 pt-2">
              <button
                type="button"
                onClick={() => setDocModalTab('global')}
                className={`relative shrink-0 pb-3 pt-1 text-xs transition ${
                  docModalTab === 'global'
                    ? 'font-semibold text-zinc-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                    : 'font-medium text-zinc-400 hover:text-zinc-700'
                }`}
              >
                Global Knowledge Base ({globalDocs.length})
              </button>
              <button
                type="button"
                onClick={() => setDocModalTab('chat')}
                className={`relative shrink-0 ml-6 pb-3 pt-1 text-xs transition ${
                  docModalTab === 'chat'
                    ? 'font-semibold text-zinc-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600'
                    : 'font-medium text-zinc-400 hover:text-zinc-700'
                }`}
              >
                This Chat Attachments ({chatDocs.length})
              </button>
            </div>

            {/* Modal Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {docModalTab === 'global' ? (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-800">Global Knowledge Documents</h3>
                      <p className="text-[11px] text-zinc-500">
                        Indexed in the vector store and searched across all conversations.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={uploadingDoc}
                      onClick={() => docInputRef.current?.click()}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-2xs transition hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <span>＋</span>
                      <span>Upload to Global</span>
                    </button>
                  </div>

                  {uploadStatus && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                      {uploadStatus}
                    </div>
                  )}

                  {globalDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
                      <IconFileText className="h-8 w-8 text-zinc-400" />
                      <p className="mt-2 text-xs text-zinc-500">No global documents indexed yet.</p>
                      <button
                        type="button"
                        onClick={() => docInputRef.current?.click()}
                        className="mt-3 text-xs font-medium text-emerald-600 hover:underline"
                      >
                        + Upload your first PDF, image, or markdown document
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {globalDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-3 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-100/60"
                        >
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              setDocModalOpen(false);
                              openCitationPreview({ fileName: doc.fileName, pageNumber: 1, displayName: doc.fileName });
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <IconFileText className="h-4 w-4 text-zinc-500 shrink-0" />
                              <span className="truncate text-xs font-medium text-zinc-900">{doc.fileName}</span>
                              <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-medium text-emerald-800">
                                Global
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                              <span>{doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}</span>
                              <span>·</span>
                              <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                              <span>·</span>
                              <span className="text-indigo-600 font-medium hover:underline">Click to preview passages</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            title={`Delete ${doc.fileName}`}
                            onClick={() => handleDeleteDocument(doc.fileName)}
                            className="ml-3 rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-800">Chat Attachments</h3>
                      <p className="text-[11px] text-zinc-500">
                        Attached exclusively to this active conversation session.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={uploadingDoc}
                      onClick={() => chatDocInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-2xs transition hover:bg-indigo-100 disabled:opacity-40"
                    >
                      <span>＋</span>
                      <span>Attach to This Chat</span>
                    </button>
                  </div>

                  {uploadStatus && (
                    <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 text-xs text-indigo-800">
                      {uploadStatus}
                    </div>
                  )}

                  {chatDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
                      <IconPaperclip className="h-8 w-8 text-zinc-400" />
                      <p className="mt-2 text-xs text-zinc-500">No documents attached to this chat session.</p>
                      <button
                        type="button"
                        onClick={() => chatDocInputRef.current?.click()}
                        className="mt-3 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        + Attach a document for this conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chatDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-3 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-100/60"
                        >
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              setDocModalOpen(false);
                              openCitationPreview({ fileName: doc.fileName, pageNumber: 1, displayName: doc.fileName });
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <IconFileText className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span className="truncate text-xs font-medium text-zinc-900">{doc.fileName}</span>
                              <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[9px] font-medium text-indigo-800">
                                This Chat
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                              <span>{doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}</span>
                              <span>·</span>
                              <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                              <span>·</span>
                              <span className="text-indigo-600 font-medium hover:underline">Click to preview passages</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            title={`Remove ${doc.fileName}`}
                            onClick={() => handleDeleteDocument(doc.fileName)}
                            className="ml-3 rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-6 py-3.5 text-xs text-zinc-500">
              <span>{documents.length} total document(s) in local vector store</span>
              <button
                type="button"
                onClick={() => setDocModalOpen(false)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-2xs hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auth Modal (Google & Apple Sign In) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-[#ded9cf] bg-[#fdfcf9] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#eeece5]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 text-xs font-semibold text-white">
                  AI
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">Sign in to Local AI</h3>
                  <p className="text-[11px] text-stone-500">Sync projects & chats across devices</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthModalOpen(false);
                  setAuthError('');
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-[#eeece5] hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="pt-5 space-y-3">
              {!isCloudConfigured && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
                  <p className="font-semibold mb-1">⚙️ Supabase Setup Required</p>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Add <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">.env.local</code> file to enable cloud login.
                  </p>
                </div>
              )}

              {authError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {authError}
                </div>
              )}

              <button
                type="button"
                disabled={authLoading}
                onClick={signInWithGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#ded9cf] bg-white px-4 py-3 text-xs font-medium text-stone-800 shadow-2xs transition hover:bg-stone-50 hover:border-[#cfc9be] disabled:opacity-50"
              >
                <IconGoogle className="h-4 w-4" />
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                disabled={authLoading}
                onClick={signInWithApple}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3 text-xs font-medium text-white shadow-2xs transition hover:bg-stone-800 disabled:opacity-50"
              >
                <IconApple className="h-4 w-4" />
                <span>Continue with Apple</span>
              </button>

              <p className="pt-2 text-center text-[10px] text-stone-400 leading-tight">
                LLM inference runs 100% locally on your machine via Ollama. Only your conversation titles and project structure sync to your private Supabase cloud database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Creation Modal */}
      {projectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#ded9cf] bg-[#fdfcf9] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#eeece5]">
              <div className="flex items-center gap-2">
                <IconFolder className="h-4 w-4 text-stone-700" />
                <h3 className="text-sm font-semibold text-stone-900">
                  {editingProject ? 'Edit Workspace Project' : 'New Workspace Project'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProjectModalOpen(false);
                  setEditingProject(null);
                  setNewProjectName('');
                  setNewProjectDesc('');
                  setNewProjectPrompt('');
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-[#eeece5] hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="pt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Linkedin, Dare, Master Thesis"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-xl border border-[#ded9cf] bg-white px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#6366f1', label: 'Indigo' },
                    { color: '#10b981', label: 'Emerald' },
                    { color: '#f59e0b', label: 'Amber' },
                    { color: '#ef4444', label: 'Rose' },
                    { color: '#8b5cf6', label: 'Purple' },
                    { color: '#06b6d4', label: 'Cyan' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setNewProjectColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className={`h-6 w-6 rounded-full transition transform ${
                        newProjectColor === c.color
                          ? 'ring-2 ring-stone-900 ring-offset-2 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-stone-700">
                    Custom System Prompt / Instructions (Optional)
                  </label>
                  <span className="text-[10px] text-stone-400">Injected into Qwen 2.5</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="e.g. Act as a senior technical recruiter reviewing CVs. Focus on action verbs, quantify impact, and keep feedback concise and actionable."
                  value={newProjectPrompt}
                  onChange={(e) => setNewProjectPrompt(e.target.value)}
                  className="w-full rounded-xl border border-[#ded9cf] bg-white px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none resize-none"
                />
                <p className="mt-1 text-[10.5px] text-stone-400 leading-tight">
                  Custom instructions automatically applied to every chat in this project.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dedicated docs and chats for innovation"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full rounded-xl border border-[#ded9cf] bg-white px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProjectModalOpen(false);
                    setEditingProject(null);
                    setNewProjectName('');
                    setNewProjectDesc('');
                    setNewProjectPrompt('');
                  }}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-stone-600 hover:bg-[#eeece5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-medium text-white shadow-2xs hover:bg-stone-800 disabled:opacity-40"
                >
                  {creatingProject ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ChatApp />
    </Suspense>
  );
}
