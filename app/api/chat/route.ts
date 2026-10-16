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

const BASE_SYSTEM_PROMPT = `You are a helpful, intelligent, and accurate AI assistant.
Answer the user's questions clearly, concisely, and factually.

Grounding and Citation Guidelines:
- Base your answers strictly on the retrieved context documents when available.
- Always cite your sources with document name and page number (e.g., [document.pdf, Page 3]).
- If the retrieved context does not contain enough information to answer, state that clearly.
- Never invent facts or hallucinate details not present in the context.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

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
            if (
              part.type === 'file' &&
              typeof part.mediaType === 'string' &&
              part.mediaType.startsWith('image/') &&
              typeof part.url === 'string' &&
              part.url.startsWith('data:')
            ) {
              try {
                // Decode base64 image data URL
                const base64Data = part.url.split(',')[1];
                if (base64Data) {
                  const buffer = Buffer.from(base64Data, 'base64');
                  const doc = await DocumentPreprocessor.processImage(
                    buffer,
                    part.filename || 'uploaded-image.png',
                    part.mediaType,
                  );
                  return {
                    type: 'text',
                    text: `\n[Image Attachment OCR Extracted Text: ${part.filename || 'image'}]\n${doc.pages[0]?.text || ''}\n`,
                  };
                }
              } catch (ocrErr) {
                console.error('Image OCR error in chat:', ocrErr);
              }
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
    if (lastUserMsg) {
      if (typeof lastUserMsg.content === 'string') {
        queryText = lastUserMsg.content;
      } else if (Array.isArray(lastUserMsg.parts)) {
        queryText = lastUserMsg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join(' ');
      }
    }

    // Step 3: Retrieve top matching chunks from LocalVectorStore (Cortex Search equivalent)
    let contextBlock = '';
    if (queryText.trim().length > 0) {
      try {
        const searchResults = await LocalVectorStore.search(queryText.trim(), 5);
        if (searchResults.length > 0) {
          const formatted = LocalVectorStore.formatSearchResults(searchResults);
          contextBlock = `\n\n--- RETRIEVED CONTEXT DOCUMENTS (FROM VECTOR STORE) ---\n${formatted}\n----------------------------------------------------\n`;
        }
      } catch (searchErr) {
        console.error('Vector store search error:', searchErr);
      }
    }

    const effectiveSystemPrompt = `${BASE_SYSTEM_PROMPT}${contextBlock}`;

    console.log('[Local AI] Selected model:', TEXT_MODEL);
    console.log('[Local AI] Injected context length:', contextBlock.length);

    const startTime = Date.now();
    const modelMessages = await convertToModelMessages(processedMessages);

    const result = streamText({
      model: ollama.chatModel(TEXT_MODEL),
      system: effectiveSystemPrompt,
      messages: modelMessages,
      temperature: 0.1, // Matches enterprise low temperature for strict grounding
      maxTokens: 1024, // Maximum output length

      providerOptions: {
        ollama: {
          num_ctx: 8192, // 8K context window for document chunks (gentle on 8GB M1)
          num_predict: 1024,
          stream_options: {
            include_usage: true,
          },
        },
      },

      onFinish: ({ usage }) => {
        const durationMs = Date.now() - startTime;
        console.log('[Local AI usage]', {
          model: TEXT_MODEL,
          inputTokens: usage.inputTokens ?? 'unavailable',
          outputTokens: usage.outputTokens ?? 'unavailable',
          durationMs,
        });
      },
    });

    return result.toUIMessageStreamResponse();
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