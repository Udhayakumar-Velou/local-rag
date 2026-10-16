
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

interface ChatMetrics {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  tokensPerSecond?: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: number;
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

  if (!firstMessage) return 'New chat';

  const text = getMessageText(firstMessage).trim();

  return text.length > 32
    ? `${text.slice(0, 32)}…`
    : text || 'Image conversation';
}

function getMessageMetrics(
  message: UIMessage,
): ChatMetrics | undefined {
  const metadata = (
    message as UIMessage & { metadata?: ChatMetrics }
  ).metadata;

  if (!metadata) return undefined;

  if (
    metadata.inputTokens == null &&
    metadata.outputTokens == null &&
    metadata.totalTokens == null &&
    metadata.durationMs == null
  ) {
    return undefined;
  }

  return metadata;
}

function getLatestMetrics(
  messages: UIMessage[],
): ChatMetrics | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'assistant') continue;

    const metrics = getMessageMetrics(messages[i]);

    if (metrics) return metrics;
  }

  return undefined;
}

function formatNumber(value?: number): string {
  return value == null ? '—' : value.toLocaleString();
}

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    messages: [],
    updatedAt: Date.now(),
  };
}

function ChatApp() {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<
    Conversation[]
  >([]);
  const [activeId, setActiveId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState('');
  const [documents, setDocuments] = useState<Array<{ id: string; fileName: string; pageCount: number; fileSize: number }>>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const activeIdRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
  } = useChat();

  const isLoading =
    status === 'submitted' || status === 'streaming';

  // Restore saved conversations.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[];

        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = [...parsed].sort(
            (a, b) => b.updatedAt - a.updatedAt,
          );

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

  // Keep the active conversation updated.
  useEffect(() => {
    if (!ready || !activeId) return;

    setConversations((previous) => {
      const current: Conversation = {
        id: activeId,
        title: getTitle(messages),
        messages,
        updatedAt: Date.now(),
      };

      const exists = previous.some(
        (conversation) => conversation.id === activeId,
      );

      const updated = exists
        ? previous.map((conversation) =>
            conversation.id === activeId
              ? current
              : conversation,
          )
        : [current, ...previous];

      return updated.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
    });
  }, [messages, activeId, ready]);

  // Persist conversation history in this browser.
  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations),
      );
    } catch (err) {
      console.error(
        'Could not save chat history:',
        err,
      );
    }
  }, [conversations, ready]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages, isLoading]);

  const startNewChat = useCallback(() => {
    if (isLoading) return;

    const conversation = createConversation();

    activeIdRef.current = conversation.id;
    setActiveId(conversation.id);
    setMessages([]);
    setInput('');
    setSelectedImages([]);
    setImageError('');
    setSidebarOpen(false);

    setConversations((previous) => [
      conversation,
      ...previous,
    ]);

    textareaRef.current?.focus();
  }, [isLoading, setMessages]);

  const switchConversation = useCallback(
    (conversation: Conversation) => {
      if (isLoading) return;

      activeIdRef.current = conversation.id;
      setActiveId(conversation.id);
      setMessages(conversation.messages ?? []);
      setInput('');
      setSelectedImages([]);
      setImageError('');
      setSidebarOpen(false);
    },
    [isLoading, setMessages],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (isLoading) return;

      const remaining = conversations.filter(
        (conversation) => conversation.id !== id,
      );

      if (id === activeId) {
        const next = remaining[0] ?? createConversation();

        activeIdRef.current = next.id;
        setActiveId(next.id);
        setMessages(next.messages ?? []);

        setConversations(
          remaining.length === 0 ? [next] : remaining,
        );
      } else {
        setConversations(remaining);
      }
    },
    [activeId, conversations, isLoading, setMessages],
  );

  // Validate and add selected images.
  function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) return;

    setImageError('');

    const validFiles: File[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setImageError(
          `${file.name}: use JPG, PNG, WebP, or GIF.`,
        );
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setImageError(
          `${file.name}: the maximum image size is 10 MB.`,
        );
        continue;
      }

      validFiles.push(file);
    }

    setSelectedImages((previous) =>
      [...previous, ...validFiles].slice(0, 4),
    );
  }

  function removeImage(index: number) {
    setSelectedImages((previous) =>
      previous.filter((_, i) => i !== index),
    );
    setImageError('');
  }

  async function handleDocUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingDoc(true);
    setUploadStatus(`Indexing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadStatus(`Upload failed: ${data.error || 'Server error'}`);
      } else {
        setUploadStatus(`Indexed ${data.filename} (${data.pages} pages, ${data.chunksCount} chunks)`);
        await fetchDocuments();
        setTimeout(() => setUploadStatus(''), 4000);
      }
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message || 'Network error'}`);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const text = input.trim();

    if (
      (!text && selectedImages.length === 0) ||
      isLoading ||
      !ready
    ) {
      return;
    }

    const filesToSend = [...selectedImages];

    setInput('');
    setSelectedImages([]);
    setImageError('');

    try {
      const fileList = new DataTransfer();

      filesToSend.forEach((file) => {
        fileList.items.add(file);
      });

      await sendMessage({
        text,
        files: fileList.files,
      });
    } catch (err) {
      console.error('Could not send message:', err);
      setImageError(
        'The message could not be sent. Please try again.',
      );
    }
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeId,
  );

  const latestMetrics = getLatestMetrics(messages);

  return (
    <main className="flex h-dvh overflow-hidden bg-[#0b0b0c] text-[#ededed]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-white/[0.08] bg-[#101011] transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/[0.07] px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-semibold text-black">
              L
            </div>
            <span className="text-sm font-medium">
              Local AI
            </span>
          </div>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/50 hover:bg-white/[0.07] md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={startNewChat}
            disabled={isLoading || !ready}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.1] px-3 py-3 text-sm text-white/85 transition hover:bg-white/[0.06] disabled:opacity-40"
          >
            <span className="text-lg leading-none">＋</span>
            New chat
          </button>
        </div>

        <div className="px-4 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-white/35">
          Recent conversations
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {conversations.length === 0 ? (
            <p className="px-3 py-4 text-xs text-white/35">
              Your conversations will appear here.
            </p>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === activeId;

              return (
                <div
                  key={conversation.id}
                  className={`group mb-1 flex items-center gap-1 rounded-lg transition ${
                    active
                      ? 'bg-white/[0.09]'
                      : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      switchConversation(conversation)
                    }
                    disabled={isLoading}
                    title={conversation.title}
                    className="min-w-0 flex-1 truncate px-3 py-3 text-left text-[13px] text-white/75 disabled:cursor-not-allowed"
                  >
                    <span className="block truncate">
                      {conversation.title}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete ${conversation.title}`}
                    title="Delete conversation"
                    onClick={() =>
                      deleteConversation(conversation.id)
                    }
                    disabled={isLoading}
                    className="mr-1 rounded-md p-2 text-white/30 transition hover:bg-white/10 hover:text-red-300 disabled:opacity-20 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path
                        d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Knowledge Base Section */}
        <div className="border-t border-white/[0.07] px-4 pb-2 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
              Knowledge Base ({documents.length})
            </span>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDoc}
              className="text-[11px] text-white/60 hover:text-white"
            >
              + Upload
            </button>
          </div>
        </div>
        <div className="max-h-36 overflow-y-auto px-2 pb-2">
          {uploadStatus && (
            <p className="truncate px-3 py-1 text-xs text-emerald-400">
              {uploadStatus}
            </p>
          )}
          {documents.length === 0 ? (
            <p className="px-3 py-1 text-xs text-white/30">
              No docs indexed yet.
            </p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="mb-1 rounded-md px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.04]"
                title={`${doc.fileName} (${doc.pageCount} pages)`}
              >
                <div className="truncate font-medium">{doc.fileName}</div>
                <div className="text-[10px] text-white/35">
                  {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-white/55">
              Qwen 2.5 · Running locally
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-white/30">
            Local vector RAG active.
          </p>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-white/60 hover:bg-white/[0.07] md:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium">
                {activeConversation?.title || 'New chat'}
              </h1>
              <p className="text-xs text-white/40">
                Your personal assistant
              </p>
            </div>
          </div>

          {/* Model and latest response metrics */}
          <div
            title={
              latestMetrics
                ? `Input: ${formatNumber(latestMetrics.inputTokens)} tokens | Output: ${formatNumber(latestMetrics.outputTokens)} tokens | Total: ${formatNumber(latestMetrics.totalTokens)} tokens`
                : 'Token metrics appear when usage data is available.'
            }
            className="flex shrink-0 flex-col gap-1 rounded-xl border border-white/[0.08] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-white/70">
                {latestMetrics?.model ?? 'Qwen3'} · Local
              </span>
            </div>

            <div className="text-[10px] leading-4 text-white/45">
              {latestMetrics ? (
                <>
                  <div>
                    In: {formatNumber(latestMetrics.inputTokens)}
                    {' · '}
                    Out: {formatNumber(latestMetrics.outputTokens)}
                  </div>
                  <div>
                    Total: {formatNumber(latestMetrics.totalTokens)} tokens
                  </div>
                  <div>
                    {latestMetrics.durationMs != null
                      ? `${(latestMetrics.durationMs / 1000).toFixed(2)} s`
                      : 'Time: —'}
                    {latestMetrics.tokensPerSecond != null &&
                      ` · ${latestMetrics.tokensPerSecond} tok/s`}
                  </div>
                </>
              ) : (
                <div>
                  {isLoading
                    ? 'Generating response…'
                    : 'Token metrics unavailable'}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 sm:px-8">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center pb-12">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h2 className="text-center text-2xl font-medium tracking-tight sm:text-3xl">
                  What can I help with?
                </h2>

                <p className="mt-3 text-center text-sm text-white/40">
                  A private AI assistant running on your machine.
                </p>

                <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    'Explain a concept',
                    'Help me write',
                    'Explore an idea',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-xl border border-white/[0.09] px-3 py-3 text-left text-sm text-white/60 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8 py-8 sm:py-10">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const metrics = !isUser
                    ? getMessageMetrics(message)
                    : undefined;

                  return (
                    <div
                      key={message.id}
                      className={`flex w-full gap-3 sm:gap-4 ${
                        isUser ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {!isUser && (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-medium text-black">
                          L
                        </div>
                      )}

                      <div
                        className={`min-w-0 ${
                          isUser
                            ? 'max-w-[85%] rounded-2xl bg-[#303033] px-4 py-3 sm:max-w-[75%]'
                            : 'flex-1 pt-1'
                        }`}
                      >
                        {!isUser && (
                          <p className="mb-2 text-xs font-medium text-white/45">
                            Assistant
                          </p>
                        )}

                        <div
                          className={`markdown-content text-sm leading-7 ${
                            isUser
                              ? 'break-words text-white'
                              : 'text-white/85'
                          }`}
                        >
                          {message.parts.map((part, index) => {
                            if (part.type === 'text') {
                              return isUser ? (
                                <p
                                  key={index}
                                  className="whitespace-pre-wrap"
                                >
                                  {part.text}
                                </p>
                              ) : (
                                <ReactMarkdown
                                  key={index}
                                  remarkPlugins={[remarkGfm]}
                                >
                                  {part.text}
                                </ReactMarkdown>
                              );
                            }

                            if (
                              part.type === 'file' &&
                              part.mediaType?.startsWith('image/')
                            ) {
                              return (
                                <div key={index} className="my-2">
                                  <img
                                    src={part.url}
                                    alt={part.filename || 'Attached image'}
                                    className="max-h-80 max-w-full rounded-xl border border-white/10 object-contain"
                                  />
                                  {part.filename && (
                                    <p className="mt-1 text-xs text-white/40">
                                      {part.filename}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>

                        {metrics && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.07] pt-2 text-[10px] text-white/35">
                            <span>
                              In: {formatNumber(metrics.inputTokens)}
                            </span>
                            <span>
                              Out: {formatNumber(metrics.outputTokens)}
                            </span>
                            <span>
                              Total: {formatNumber(metrics.totalTokens)}
                            </span>
                            {metrics.durationMs != null && (
                              <span>
                                {(metrics.durationMs / 1000).toFixed(2)} s
                              </span>
                            )}
                            {metrics.tokensPerSecond != null && (
                              <span>
                                {metrics.tokensPerSecond} tok/s
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                          Y
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-3 pl-10">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-white/40">
                      Thinking
                    </span>
                  </div>
                )}

                {error && (
                  <p className="ml-10 text-sm text-red-400">
                    Could not generate a response. Check that Ollama is running, then try again.
                  </p>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Message composer */}
        <div className="shrink-0 px-3 pb-4 pt-3 sm:px-8 sm:pb-6">
          <div className="mx-auto max-w-3xl">
            {selectedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {selectedImages.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="relative rounded-xl border border-white/10 bg-[#181819] p-2"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <p className="mt-1 max-w-20 truncate text-[10px] text-white/50">
                      {file.name}
                    </p>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeImage(index)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#303033] text-xs hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {imageError && (
              <p className="mb-2 text-xs text-red-400">
                {imageError}
              </p>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/[0.12] bg-[#141415] p-2 transition focus-within:border-white/25"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  selectedImages.length > 0
                    ? 'Ask a question about your image...'
                    : 'Message your assistant...'
                }
                rows={1}
                disabled={!ready}
                className="max-h-40 min-h-12 w-full resize-y bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/30"
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
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv"
                onChange={handleDocUpload}
                className="hidden"
              />

              <div className="flex items-center justify-between px-1 pb-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Attach images to chat"
                    aria-label="Attach images"
                    disabled={!ready || isLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                      />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path
                        d="m21 15-5-5L5 21"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    title="Upload document to Knowledge Base (PDF, Images, Text)"
                    aria-label="Upload document"
                    disabled={!ready || isLoading || uploadingDoc}
                    onClick={() => docInputRef.current?.click()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <span className="text-xs text-white/30">
                    {uploadingDoc
                      ? 'Indexing document...'
                      : selectedImages.length > 0
                      ? `${selectedImages.length}/4 images selected`
                      : 'Qwen 2.5 + Local Vector RAG'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (!input.trim() && selectedImages.length === 0) ||
                    !ready
                  }
                  aria-label="Send message"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                </button>
              </div>
            </form>

            <p className="mt-3 text-center text-[11px] text-white/25">
              Local inference · Conversations saved in this browser
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex h-dvh items-center justify-center bg-[#0b0b0c] text-sm text-white/50">
          Loading Local AI...
        </main>
      }
    >
      <ChatApp />
    </Suspense>
  );
}
