import { NextRequest, NextResponse } from 'next/server';
import { loadLeadAgentSettings, saveLeadAgentSettings } from '@/lib/lead-agent/settings';

export async function GET() {
  try {
    const settings = await loadLeadAgentSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load Lead Agent settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await saveLeadAgentSettings(body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to save Lead Agent settings' },
      { status: 500 }
    );
  }
}
