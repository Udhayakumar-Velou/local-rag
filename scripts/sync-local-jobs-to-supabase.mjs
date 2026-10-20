import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
const keyMatch = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m);

if (!urlMatch || !keyMatch) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

function computeCanonicalKey(company, title, city) {
  const c = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = (title || '')
    .toLowerCase()
    .replace(/\b(h\/f|f\/h|m\/f|cdi|cdd)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  const l = (city || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${c}::${t}::${l}`;
}

async function sync() {
  if (!fs.existsSync('data/job-leads.json')) {
    console.log('No local data/job-leads.json found.');
    return;
  }

  const local = JSON.parse(fs.readFileSync('data/job-leads.json', 'utf8'));
  const jobs = Array.isArray(local.jobs) ? local.jobs : [];
  console.log(`Found ${jobs.length} local jobs in data/job-leads.json.`);

  const rows = jobs.map((j) => ({
    id: j.id,
    canonical_key: computeCanonicalKey(j.companyName, j.exactJobTitle, j.city),
    job_data: j,
    user_status: j.userStatus || 'inbox',
    overall_score: j.overallScore || 0,
    job_category: j.jobCategory || 'Combined AI + Software Engineering',
    updated_at: new Date().toISOString(),
  }));

  console.log('Uploading jobs to Supabase table job_leads...');
  // Upload in batches of 20
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const { error } = await supabase.from('job_leads').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error('Error inserting batch into job_leads:', error.message);
      return;
    }
    console.log(`Uploaded batch ${i + 1} to ${Math.min(i + 20, rows.length)}`);
  }

  console.log('✓ Successfully synced all local jobs to Supabase Cloud!');
}

sync();
