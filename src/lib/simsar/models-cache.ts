// Simsar Models Cache - Fetches and caches AI models from HuggingFace Router

export interface ModelInfo {
    id: string;
    name: string;
    owned_by?: string;
    isMultimodal?: boolean;
    supportsMcp?: boolean;
}

interface ModelsCache {
    models: ModelInfo[];
    lastFetched: number;
}

// Cache TTL: 12 hours
const CACHE_TTL = 12 * 60 * 60 * 1000;
let cache: ModelsCache | null = null;

// Known multimodal models (support image input)
const MULTIMODAL_PATTERNS = [
    'vision', 'vl', 'multimodal', 'omni', 'pixtral',
    'llava', 'cogvlm', 'qwen2-vl', 'internvl',
];

function isMultimodal(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    return MULTIMODAL_PATTERNS.some(p => lower.includes(p));
}

const MCP_CAPABLE_PATTERNS = [
    'llama-3', 'qwen2.5', 'gemini', 'claude-3', 'gpt-4', 'mixtral', 'deepseek', 'gpt-3.5', 'nova'
];

function supportsMcp(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    return MCP_CAPABLE_PATTERNS.some(p => lower.includes(p));
}

export async function getModels(apiKey: string, forceRefresh = false): Promise<ModelInfo[]> {
    // Return cached if valid
    if (!forceRefresh && cache && (Date.now() - cache.lastFetched) < CACHE_TTL) {
        return cache.models;
    }

    try {
        const response = await fetch('https://router.huggingface.co/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            console.error(`Failed to fetch models: ${response.status}`);
            return cache?.models || [];
        }

        const data = await response.json();
        const models: ModelInfo[] = (data.data || []).map((m: { id: string; owned_by?: string }) => ({
            id: m.id,
            name: m.id.split('/').pop() || m.id,
            owned_by: m.owned_by,
            isMultimodal: isMultimodal(m.id),
            supportsMcp: supportsMcp(m.id),
        }));

        // Sort: put popular models first
        models.sort((a, b) => {
            const popularOrder = [
                'meta-llama', 'qwen', 'deepseek', 'mistralai', 'google',
                'microsoft', 'openai', 'nvidia', 'cohere',
            ];
            const aOrg = a.id.split('/')[0]?.toLowerCase() || '';
            const bOrg = b.id.split('/')[0]?.toLowerCase() || '';
            const aIdx = popularOrder.findIndex(p => aOrg.includes(p));
            const bIdx = popularOrder.findIndex(p => bOrg.includes(p));
            const aScore = aIdx >= 0 ? aIdx : 999;
            const bScore = bIdx >= 0 ? bIdx : 999;
            return aScore - bScore;
        });

        cache = { models, lastFetched: Date.now() };
        return models;
    } catch (error) {
        console.error('Error fetching models:', error);
        return cache?.models || [];
    }
}

export function getCachedModels(): ModelInfo[] {
    return cache?.models || [];
}

export function getLastFetchTime(): number | null {
    return cache?.lastFetched || null;
}
