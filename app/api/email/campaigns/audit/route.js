import { NextResponse } from 'next/server';
import { auditCampaignAudience } from '@/lib/services/campaignService';

export async function POST(request) {
  try {
    const filterCriteria = await request.json();
    const auditResult = await auditCampaignAudience(filterCriteria);
    return NextResponse.json({ success: true, data: auditResult });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
