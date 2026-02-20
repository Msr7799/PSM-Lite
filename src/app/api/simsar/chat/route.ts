import { NextRequest, NextResponse } from 'next/server';
import { getSimsarConfig, DEFAULT_SYSTEM_PROMPT } from '@/lib/simsar/config';
import { getPropertyContext, formatContextForAI } from '@/lib/simsar/context-provider';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Attachment {
  filename: string;
  type: string;
  size: number;
  extractedText: string;
  imageBase64?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      stream = true,
      modelId,
      conversationId,
      attachments,
    } = await request.json();

    const config = getSimsarConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'سمسار غير مُعَد. يرجى إضافة SIMSAR_API_KEY في ملف .env' },
        { status: 500 }
      );
    }

    // Override model if specified
    const activeModel = modelId || config.model;

    // Get property context
    const context = await getPropertyContext();
    const contextText = formatContextForAI(context);

    // Build attachment context if any
    let attachmentContext = '';
    if (attachments && attachments.length > 0) {
      attachmentContext = '\n\n---\n\n📎 **ملفات مرفقة:**\n';
      for (const att of attachments as Attachment[]) {
        attachmentContext += `\n### ملف: ${att.filename} (${(att.size / 1024).toFixed(1)} KB)\n`;
        attachmentContext += att.extractedText + '\n';
      }
    }

    // Build messages with system prompt and context
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `${DEFAULT_SYSTEM_PROMPT}\n\n---\n\n${contextText}${attachmentContext}`,
    };

    const allMessages: ChatMessage[] = [systemMessage, ...messages];

    // Save user message to DB if conversationId is provided
    let convId = conversationId;
    const lastUserMsg = messages[messages.length - 1];

    if (convId && lastUserMsg?.role === 'user') {
      try {
        await prisma.simsarMessage.create({
          data: {
            conversationId: convId,
            role: 'user',
            content: lastUserMsg.content,
            attachments: attachments && attachments.length > 0
              ? attachments.map((a: Attachment) => ({
                filename: a.filename,
                type: a.type,
                size: a.size,
              }))
              : undefined,
          },
        });

        // Update conversation
        await prisma.simsarConversation.update({
          where: { id: convId },
          data: {
            modelId: activeModel,
            updatedAt: new Date(),
            // Auto-generate title from first message
            ...(messages.length === 1
              ? { title: lastUserMsg.content.slice(0, 80) }
              : {}),
          },
        });
      } catch (error) {
        console.error('Error saving user message:', error);
      }
    }

    if (stream) {
      return streamResponse(
        { ...config, model: activeModel },
        allMessages,
        convId
      );
    } else {
      return nonStreamResponse(
        { ...config, model: activeModel },
        allMessages,
        convId
      );
    }
  } catch (error) {
    console.error('Simsar API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

async function streamResponse(
  config: ReturnType<typeof getSimsarConfig> & { model: string },
  messages: ChatMessage[],
  conversationId?: string
) {
  if (!config) throw new Error('Config not found');

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let apiUrl: string;
        let headers: Record<string, string>;
        let body: string;

        if (config.provider === 'huggingface') {
          apiUrl = 'https://router.huggingface.co/v1/chat/completions';
          headers = {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          };
          body = JSON.stringify({
            model: config.model,
            messages,
            stream: true,
            max_tokens: 4096,
          });
        } else if (config.provider === 'openrouter') {
          apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
          headers = {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          };
          body = JSON.stringify({
            model: config.model,
            messages,
            stream: true,
            max_tokens: 4096,
          });
        } else if (config.provider === 'google') {
          apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
          headers = { 'Content-Type': 'application/json' };
          body = JSON.stringify({
            contents: messages.map(m => ({
              role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: 4096 },
          });
        } else {
          throw new Error('Unsupported provider');
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                let content = '';

                if (config.provider === 'google') {
                  content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } else {
                  content = parsed.choices?.[0]?.delta?.content || '';
                }

                if (content) {
                  fullContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Save assistant message to DB
        if (conversationId && fullContent) {
          try {
            await prisma.simsarMessage.create({
              data: {
                conversationId,
                role: 'assistant',
                content: fullContent,
              },
            });
          } catch (error) {
            console.error('Error saving assistant message:', error);
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function nonStreamResponse(
  config: ReturnType<typeof getSimsarConfig> & { model: string },
  messages: ChatMessage[],
  conversationId?: string
) {
  if (!config) throw new Error('Config not found');

  let apiUrl: string;
  let headers: Record<string, string>;
  let body: string;

  if (config.provider === 'huggingface') {
    apiUrl = 'https://router.huggingface.co/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 4096,
    });
  } else if (config.provider === 'openrouter') {
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 4096,
    });
  } else {
    throw new Error('Unsupported provider for non-streaming');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Save assistant message to DB
  if (conversationId && content) {
    try {
      await prisma.simsarMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content,
        },
      });
    } catch (error) {
      console.error('Error saving assistant message:', error);
    }
  }

  return NextResponse.json({ content });
}
