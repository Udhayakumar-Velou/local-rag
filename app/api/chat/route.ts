import fs from 'fs';
import path from 'path';
import { convertToModelMessages, streamText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LocalVectorStore } from '@/lib/rag/vector-store';
import { DocumentPreprocessor } from '@/lib/rag/document-preprocessor';

// Single text-only model as requested (Qwen 2.5)
const TEXT_MODEL = process.env.CHAT_MODEL || 'qwen2.5:3b';

const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: process.env.OLLAMA_HOST ? `${process.env.OLLAMA_HOST}/v1` : 'http://127.0.0.1:11434/v1',
  apiKey: 'ollama',
});

const BASE_SYSTEM_PROMPT = `You are a perceptive, highly capable AI assistant.
Answer the user's questions clearly, concisely, and intelligently.

Document Grounding & Knowledge Integration:
1. Primary Reference: When context documents are retrieved from the knowledge base, treat them as the primary source of truth for facts, project specifics, data, and user files.
2. Accurate Citations: Always cite your sources with document name and page number (e.g., [document.pdf, Page 3]) whenever answering from retrieved documents.
3. Intelligent Synthesis: Combine the information from the documents with your broad technical knowledge and reasoning. If the user asks for explanations, comparisons, code implementations, or advice related to the topics in their documents, provide complete, helpful answers rather than refusing.
4. Multiple Documents: If multiple documents are available or relevant (e.g. reports, assignment guidelines, or documentation), connect insights across them seamlessly.
5. Image & Visual Understanding:
   - When the user asks about an image, screenshot, or graphic (e.g. "what do you see in this image", "what about this image"), analyze all extracted text, UI buttons, locations, labels, and context provided in the attachment.
   - Explain what the image represents: identify the interface or design (e.g. a mobile map navigation/tracking screen with points of interest, a 3D folder branding asset, or a website mockup).
   - If an image has minimal text, describe what the asset represents based on its title, file metadata, and layout, and offer helpful commentary rather than giving a flat refusal or complaining about OCR text.
6. Honesty & Helpfulness: Always provide constructive, insightful answers based on all available context.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, conversationId, customPrompt } = body;

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request: messages must be an array.' },
        { status: 400 },
      );
    }

    // Step 1: Pre-process any attached images in the conversation using OCR overlay
    // This allows the pure text Qwen 2.5 model to read and reason over images
    const processedMessages = await Promise.all(
      messages.map(async (message: any) => {
        if (message.role !== 'user' || !Array.isArray(message.parts)) {
          return message;
        }

        const newParts = await Promise.all(
          message.parts.map(async (part: any) => {
            if (part.type === 'file') {
              const fileName = part.filename || 'attachment';
              const mediaType = part.mediaType || 'application/octet-stream';

              let buffer: Buffer | null = null;
              if (typeof part.url === 'string' && part.url.startsWith('data:')) {
                const base64Data = part.url.split(',')[1];
                if (base64Data) {
                  buffer = Buffer.from(base64Data, 'base64');
                }
              }

              // Fallback to locally uploaded copy in data/documents
              if (!buffer && fileName) {
                const localPath = path.join(process.cwd(), 'data', 'documents', fileName);
                if (fs.existsSync(localPath)) {
                  try {
                    buffer = fs.readFileSync(localPath);
                  } catch {}
                }
              }

              if (buffer) {
                try {
                  const doc = await DocumentPreprocessor.process(buffer, fileName, mediaType);
                  const docText = doc.pages.map((p) => p.text).join('\n\n').trim();

                  if (docText.length > 0) {
                    return {
                      type: 'text',
                      text: `\n[Attached File Content (${fileName})]:\n${docText}\n`,
                    };
                  }
                } catch (err) {
                  console.error(`Error processing attached file ${fileName} in chat:`, err);
                }
              }

              // Fallback text part if binary file cannot be processed directly
              return {
                type: 'text',
                text: `[User attached file: ${fileName}]`,
              };
            }
            return part;
          }),
        );

        return { ...message, parts: newParts };
      }),
    );

    // Step 2: Extract latest user query for vector retrieval
    const lastUserMsg = [...processedMessages]
      .reverse()
      .find((m: any) => m.role === 'user');

    let queryText = '';
    const fileKeywords: string[] = [];

    if (lastUserMsg) {
      if (typeof lastUserMsg.content === 'string') {
        queryText = lastUserMsg.content;
      } else if (Array.isArray(lastUserMsg.parts)) {
        for (const p of lastUserMsg.parts) {
          if (p.type === 'text') {
            queryText += (queryText ? ' ' : '') + p.text;
          }
        }
      }
    }

    // Step 3: Retrieve top matching chunks from LocalVectorStore
    let contextBlock = '';
    const effectiveQuery = queryText.trim() || 'overview summary key information';
    try {
      console.log('[Local AI] User Query:', effectiveQuery, 'ConversationId:', conversationId);
      const searchResults = await LocalVectorStore.search(effectiveQuery, 5, conversationId);
      console.log('[Local AI] Chunks Retrieved:', searchResults.length);
      if (searchResults.length > 0) {
        const formatted = LocalVectorStore.formatSearchResults(searchResults);
        contextBlock = `\n\n--- RETRIEVED CONTEXT DOCUMENTS (FROM VECTOR STORE) ---\n${formatted}\n----------------------------------------------------\n`;
      }
    } catch (searchErr) {
      console.error('Vector store search error:', searchErr);
    }

    let effectiveSystemPrompt = BASE_SYSTEM_PROMPT;
    if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
      effectiveSystemPrompt = `PROJECT SPECIFIC INSTRUCTIONS:\n${customPrompt.trim()}\n\n---\n\n${BASE_SYSTEM_PROMPT}`;
    }
    effectiveSystemPrompt = `${effectiveSystemPrompt}${contextBlock}`;

    console.log('[Local AI] Selected model:', TEXT_MODEL);
    console.log('[Local AI] Injected context length:', contextBlock.length);

    const startTime = Date.now();
    const modelMessages = await convertToModelMessages(processedMessages);

    const totalPromptChars =
      effectiveSystemPrompt.length +
      processedMessages.reduce(
        (sum: number, m: any) =>
          sum + (typeof m.content === 'string' ? m.content.length : 100),
        0,
      );
    const estimatedInputTokens = Math.max(1, Math.ceil(totalPromptChars / 3.8));

    const result = streamText({
      model: ollama.chatModel(TEXT_MODEL),
      system: effectiveSystemPrompt,
      messages: modelMessages,
      temperature: 0.3, // Balanced temperature for grounded reasoning & synthesis

      providerOptions: {
        ollama: {
          num_ctx: 32768, // Max native context window for Qwen 2.5 deep document reasoning
          num_predict: 4096, // Maximum generation token budget for comprehensive responses
          stream_options: {
            include_usage: true,
          },
        },
      },

      onFinish: ({ usage, text }) => {
        const durationMs = Date.now() - startTime;
        const actualInput = usage.inputTokens ?? estimatedInputTokens;
        const actualOutput = usage.outputTokens ?? Math.max(1, Math.ceil(text.length / 3.8));
        console.log('[Local AI usage]', {
          model: TEXT_MODEL,
          inputTokens: actualInput,
          outputTokens: actualOutput,
          totalTokens: actualInput + actualOutput,
          durationMs,
          tokensPerSecond: durationMs > 0 ? Number((actualOutput / (durationMs / 1000)).toFixed(1)) : 0,
        });
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        'X-Model-Name': TEXT_MODEL,
        'X-Input-Tokens': String(estimatedInputTokens),
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      {
        error:
          'Failed to generate a response. Check that Ollama is running and Qwen 2.5 is available.',
      },
      { status: 500 },
    );
  }
}