import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/adminGuard';
import {
  developCampaignStrategy,
  analyzeAudienceSegmentation,
  generateCampaignMessaging,
  critiqueAndImproveMessaging,
  recommendFollowUpSequence,
  reviewCampaignPerformance,
  chatWithCampaignBrain,
  DEFAULT_CAMPAIGN_MODEL,
} from '@/lib/services/campaignIntelligenceService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response || auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      action = 'develop_strategy',
      model = DEFAULT_CAMPAIGN_MODEL,
      campaignContext = {},
      leadsContext = [],
      messages = [],
      userPrompt = '',
      objective = '',
      tone = 'Direct',
      angle = '',
      productFocus = 'Kaolin & Calcined Chamotte',
      currentSubject = '',
      currentBody = '',
      stats = {},
      filterCriteria = {},
    } = body;

    let result;

    switch (action) {
      case 'develop_strategy':
        result = await developCampaignStrategy({
          campaignName: campaignContext.name || body.name || '',
          objective: objective || campaignContext.objective || campaignContext.description || 'Industrial mineral supply introduction',
          leadsSample: leadsContext,
          filterCriteria: filterCriteria || campaignContext.filterCriteria || {},
          model,
        });
        break;

      case 'analyze_audience':
        result = await analyzeAudienceSegmentation({
          leads: leadsContext,
          filterCriteria: filterCriteria || campaignContext.filterCriteria || {},
          model,
        });
        break;

      case 'generate_messaging':
        result = await generateCampaignMessaging({
          objective: objective || campaignContext.objective || '',
          tone: tone || 'Direct',
          angle: angle || '',
          leadSample: leadsContext[0] || null,
          productFocus: productFocus || 'Kaolin & Calcined Chamotte',
          model,
        });
        break;

      case 'improve_messaging':
        result = await critiqueAndImproveMessaging({
          subject: currentSubject || campaignContext.subject || '',
          body: currentBody || campaignContext.body || '',
          objective: objective || campaignContext.objective || '',
          model,
        });
        break;

      case 'recommend_sequences':
        result = await recommendFollowUpSequence({
          objective: objective || campaignContext.objective || 'Mineral supply introduction',
          campaignType: campaignContext.campaignType || 'standard',
          model,
        });
        break;

      case 'review_performance':
        result = await reviewCampaignPerformance({
          stats: stats || campaignContext.stats || {},
          campaignName: campaignContext.name || '',
          model,
        });
        break;

      case 'chat': {
        const chatMessages = Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ role: 'user', content: userPrompt || 'Hello Claude, how can we improve this campaign?' }];

        result = await chatWithCampaignBrain({
          messages: chatMessages,
          campaignContext,
          leadsContext,
          model,
        });
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported campaign intelligence action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result.data || result.message,
      actualModel: result.actualModel,
      usage: result.usage,
    });
  } catch (err) {
    console.error('[Campaign Intelligence API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Campaign intelligence processing failed' },
      { status: 500 }
    );
  }
}

