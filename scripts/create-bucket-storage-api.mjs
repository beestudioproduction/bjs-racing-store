import https from 'https';

const SUPABASE_URL = 'https://ykotzsmncvyfveypeevb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrb3R6c21uY3Z5ZnZleXBlZXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTIyMjkzNywiZXhwIjoyMDY0Nzk4OTM3fQ.QAJ-ijCHTRBSPewAUtARpJW8SqvSrQudcp5g8XqkBUc';

function request(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ykotzsmncvyfveypeevb.supabase.co',
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listBuckets() {
  console.log('1. Listing buckets via Storage API...');
  try {
    const buckets = await request('GET', '/storage/v1/bucket');
    console.log(`   Found ${buckets.length} buckets:`, buckets.map(b => b.name));
    return buckets;
  } catch (err) {
    console.error('   Failed:', err.message);
    return [];
  }
}

async function createBucket(bucket) {
  console.log(`2. Creating bucket: ${bucket.name}...`);
  try {
    const result = await request('POST', '/storage/v1/bucket', bucket);
    console.log(`   Bucket ${bucket.name} created.`);
    return result;
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log(`   Bucket ${bucket.name} already exists.`);
      return null;
    }
    console.error(`   Failed:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('=== Creating missing bucket via Storage API ===\n');
  
  const existing = await listBuckets();
  const names = existing.map(b => b.name);
  
  if (!names.includes('produk-parts')) {
    await createBucket({
      id: 'produk-parts',
      name: 'produk-parts',
      public: true,
      file_size_limit: 10485760,
      allowed_mime_types: ['image/*'],
    });
  } else {
    console.log('2. Bucket produk-parts already exists.');
  }
  
  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
