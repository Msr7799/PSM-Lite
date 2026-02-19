import { NextRequest, NextResponse } from 'next/server';
import { getSimsarConfig, DEFAULT_SYSTEM_PROMPT } from '@/lib/simsar/config';
import { getPropertyContext, formatContextForAI } from '@/lib/simsar/context-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, stream = true } = await request.json();
    
    const config = getSimsarConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'سمسار غير مُعَد. يرجى إضافة SIMSAR_API_KEY في ملف .env' },
        { status: 500 }
      );
    }

    // Get property context
    const context = await getPropertyContext();
    const contextText = formatContextForAI(context);

    // Build messages with system prompt and context
    const systemMessage: Message = {
      role: 'system',
      content: `${DEFAULT_SYSTEM_PROMPT}\n\n---\n\n${contextText}`,
    };

    const allMessages: Message[] = [systemMessage, ...messages];

    if (stream) {
      return streamResponse(config, allMessages);
    } else {
      return nonStreamResponse(config, allMessages);
    }
  } catch (error) {
    console.error('Simsar API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

async function streamResponse(config: ReturnType<typeof getSimsarConfig>, messages: Message[]) {
  if (!config) throw new Error('Config not found');

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let apiUrl: string;
        let headers: Record<string, string>;
        let body: string;

        if (config.provider === 'huggingface') {
          // Use new HuggingFace Router endpoint (OpenAI-compatible)
          apiUrl = 'https://router.huggingface.co/v1/chat/completions';
          headers = {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          };
          body = JSON.stringify({
            model: config.model,
            messages,
            stream: true,
            max_tokens: 2048,
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
            max_tokens: 2048,
          });
        } else if (config.provider === 'google') {
          apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
          headers = { 'Content-Type': 'application/json' };
          body = JSON.stringify({
            contents: messages.map(m => ({
              role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: 2048 },
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
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Skip invalid JSON
              }
            }
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

async function nonStreamResponse(config: ReturnType<typeof getSimsarConfig>, messages: Message[]) {
  if (!config) throw new Error('Config not found');

  let apiUrl: string;
  let headers: Record<string, string>;
  let body: string;

  if (config.provider === 'huggingface') {
    // Use new HuggingFace Router endpoint (OpenAI-compatible)
    apiUrl = 'https://router.huggingface.co/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 2048,
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
      max_tokens: 2048,
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

  return NextResponse.json({ content });
}
