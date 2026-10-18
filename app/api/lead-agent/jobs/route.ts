import { NextRequest, NextResponse } from 'next/server';
import { loadStoredJobs, updateStoredJobStatus, upsertEvaluatedJobs } from '@/lib/lead-agent/store';

export async function GET() {
  try {
    const state = await loadStoredJobs();
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load stored jobs' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, userStatus } = body;
    if (!jobId || !userStatus) {
      return NextResponse.json({ error: 'jobId and userStatus are required' }, { status: 400 });
    }
    const jobs = await updateStoredJobStatus(jobId, userStatus);
    return NextResponse.json({ jobs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update job status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { job } = body;
    if (!job) {
      return NextResponse.json({ error: 'Job object is required' }, { status: 400 });
    }
    const result = await upsertEvaluatedJobs([job], `Manually evaluated ${job.exactJobTitle}`);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to save evaluated job' },
      { status: 500 }
    );
  }
}
