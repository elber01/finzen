/**
 * Seed the production DB at Vercel with Edwin's user + a fresh API key.
 * Calls the public /api/auth/register endpoint to create the user,
 * then we'll need a different approach for the API key (since /api/api-keys
 * requires a NextAuth session).
 *
 * Simplification: use the register endpoint to create user, then use the
 * login endpoint + cookies to call /api/api-keys to create an API key.
 */

const VERCEL_DEPLOY = process.env.VERCEL_DEPLOY || 'https://finzen-elber01s-projects.vercel.app';
const EMAIL = process.env.SEED_EMAIL || 'hamilton.edwin@gmail.com';
// [security] La contraseña real nunca va en el código — pásala por env.
const PASSWORD = process.env.NEW_PASSWORD;
if (!PASSWORD) {
  console.error('NEW_PASSWORD env var requerida');
  process.exit(1);
}

async function main() {
  console.log('Target deploy:', VERCEL_DEPLOY);

  // 1. Register the user (idempotent — fails silently if already exists)
  console.log('\n=== 1) Register user ===');
  const regRes = await fetch(`${VERCEL_DEPLOY}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Edwin', email: EMAIL, password: PASSWORD }),
  });
  console.log('Status:', regRes.status);
  console.log('Body:', (await regRes.text()).substring(0, 200));

  // 2. Get CSRF token
  console.log('\n=== 2) Get CSRF token ===');
  const csrfRes = await fetch(`${VERCEL_DEPLOY}/api/auth/csrf`);
  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const csrfBody = await csrfRes.json();
  const csrfToken = csrfBody.csrfToken;
  console.log('CSRF token:', csrfToken?.substring(0, 16) + '...');
  const cookieHeader = csrfCookies.join('; ');
  console.log('Cookies:', cookieHeader.substring(0, 80) + '...');

  // 3. Login via NextAuth credentials
  console.log('\n=== 3) Login ===');
  const loginRes = await fetch(`${VERCEL_DEPLOY}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader,
    },
    body: new URLSearchParams({
      email: EMAIL,
      password: PASSWORD,
      csrfToken,
      callbackUrl: `${VERCEL_DEPLOY}/`,
      json: 'true',
    }),
    redirect: 'manual',
  });
  console.log('Status:', loginRes.status);
  const loginCookies = loginRes.headers.getSetCookie?.() || [];
  console.log('Set-Cookie count:', loginCookies.length);
  const allCookies = [...csrfCookies, ...loginCookies].join('; ');

  // 4. Create API key
  console.log('\n=== 4) Create API key ===');
  const keyRes = await fetch(`${VERCEL_DEPLOY}/api/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': allCookies,
    },
    body: JSON.stringify({ name: 'curl test prod', permissions: 'read,write' }),
  });
  console.log('Status:', keyRes.status);
  const keyData = await keyRes.json();
  console.log('Response:', JSON.stringify(keyData, null, 2));

  if (keyData.key) {
    console.log('\n=== ✅ PRODUCTION API KEY ===');
    console.log(keyData.key);
    console.log('\nUse it with:');
    console.log(`  curl -X POST ${VERCEL_DEPLOY}/api/v1/expenses -H "X-API-Key: ${keyData.key}" -H "Content-Type: application/json" -d '{"amount": 419.99, "currency": "DOP", "category": "Alimentación"}'`);
  }
}

main().catch(e => { console.error('ERR', e); process.exit(1); });
