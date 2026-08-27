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

async function main() {
  console.log('Verifying buckets...\n');
  
  const buckets = await request('GET', '/storage/v1/bucket');
  console.log('Current buckets:');
  buckets.forEach(b => {
    const isPublic = b.public ? 'public' : 'private';
    console.log(`  - ${b.name} (${isPublic})`);
  });
  
  const hasPilok = buckets.some(b => b.name === 'produk-pilok');
  const hasParts = buckets.some(b => b.name === 'produk-parts');
  
  console.log('\nStatus:');
  console.log(`  produk-pilok: ${hasPilok ? 'EXISTS' : 'MISSING'}`);
  console.log(`  produk-parts: ${hasParts ? 'EXISTS' : 'MISSING'}`);
}

main();
