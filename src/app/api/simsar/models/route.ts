import { NextResponse } from 'next/server';
import { getSimsarConfig } from '@/lib/simsar/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Model {
  id: string;
  name: string;
  owned_by?: string;
}

export async function GET() {
  try {
    const config = getSimsarConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'سمسار غير مُعَد. يرجى إضافة SIMSAR_API_KEY في ملف .env' },
        { status: 500 }
      );
    }

    if (config.provider === 'huggingface') {
      // Fetch models from HuggingFace Router
      const response = await fetch('https://router.huggingface.co/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch models: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const models: Model[] = data.data?.map((m: { id: string; owned_by?: string }) => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id,
        owned_by: m.owned_by,
      })) || [];

      return NextResponse.json({ 
        models,
        count: models.length,
        provider: 'huggingface',
        currentModel: config.model,
      });
    }

    // Default response for other providers
    return NextResponse.json({ 
      models: [],
      provider: config.provider,
      currentModel: config.model,
    });

  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
