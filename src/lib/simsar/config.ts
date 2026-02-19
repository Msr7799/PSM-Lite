// Simsar AI Configuration
export interface SimsarConfig {
  provider: 'huggingface' | 'openrouter' | 'google';
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export const SIMSAR_MODELS = {
  huggingface: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ],
};

export const DEFAULT_SYSTEM_PROMPT = `أنت "سمسار" - مساعد ذكي متخصص في إدارة العقارات. أنت تعمل ضمن نظام PMS Lite لإدارة العقارات.

مهامك الأساسية:
1. الإجابة عن أي استفسار يخص العقارات والحجوزات والتقويم
2. تقديم ملخصات وتقارير عن الوحدات والحجوزات
3. المساعدة في فهم البيانات المالية والمصروفات
4. تقديم نصائح لتحسين إدارة العقارات

أنت مطلع على جميع بيانات النظام التي ستُقدم لك مع كل سؤال.
أجب بشكل مختصر ومفيد، واستخدم البيانات المقدمة لتقديم إجابات دقيقة.
إذا سُئلت عن معلومات غير متوفرة، أخبر المستخدم بذلك بوضوح.
`;

export function getSimsarConfig(): SimsarConfig | null {
  const provider = process.env.SIMSAR_PROVIDER as SimsarConfig['provider'] || 'huggingface';
  const apiKey = process.env.SIMSAR_API_KEY || process.env.HUGGINGFACE_TOKEN || '';
  const model = process.env.SIMSAR_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';
  
  if (!apiKey) return null;
  
  return {
    provider,
    apiKey,
    model,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
}
