import { NextRequest, NextResponse } from 'next/server';
import { getSimsarConfig } from '@/lib/simsar/config';
import { getModels, getLastFetchTime } from '@/lib/simsar/models-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const config = getSimsarConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'سمسار غير مُعَد. يرجى إضافة SIMSAR_API_KEY في ملف .env' },
        { status: 500 }
      );
    }

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    if (config.provider === 'huggingface') {
      const models = await getModels(config.apiKey, forceRefresh);

      return NextResponse.json({
        models,
        count: models.length,
        provider: 'huggingface',
        currentModel: config.model,
        lastFetched: getLastFetchTime(),
        cached: !forceRefresh,
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
