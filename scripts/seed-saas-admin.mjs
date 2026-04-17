/**
 * Cria (ou atualiza) usuário administrador da plataforma (user_type = saas_admin).
 * O perfil fica vinculado à organização `vanguarda` (ou VITE_SEED_TENANT_SLUG).
 *
 * Requer no .env.local:
 *   VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   SAAS_ADMIN_EMAIL (padrão: saas-admin@local.dev)
 *   SAAS_ADMIN_PASSWORD (padrão: saas-admin-2026)
 *   SAAS_ADMIN_NAME (padrão: Admin plataforma)
 *   VITE_SEED_TENANT_SLUG (padrão: vanguarda)
 *
 * Uso: npm run seed:saas-admin
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const p = join(root, '.env.local');
  if (!existsSync(p)) {
    throw new Error(`Arquivo não encontrado: ${p}`);
  }
  const env = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const envLocal = loadEnvLocal();
const env = { ...envLocal, ...process.env };
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const SAAS_ADMIN_EMAIL = (env.SAAS_ADMIN_EMAIL || 'saas-admin@local.dev').trim();
const SAAS_ADMIN_PASSWORD = env.SAAS_ADMIN_PASSWORD || 'saas-admin-2026';
const SAAS_ADMIN_NAME = env.SAAS_ADMIN_NAME || 'Admin plataforma';
const TENANT_SLUG = (env.VITE_SEED_TENANT_SLUG || env.VITE_DEFAULT_TENANT_SLUG || 'vanguarda').trim().toLowerCase();

if (!url || !serviceKey) {
  console.error(
    'Defina VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', TENANT_SLUG)
    .maybeSingle();

  if (orgErr) throw orgErr;
  if (!org?.id) {
    throw new Error(`Organização com slug "${TENANT_SLUG}" não encontrada. Rode as migrations.`);
  }

  let userId;

  const existing = await findUserByEmail(SAAS_ADMIN_EMAIL);
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: SAAS_ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log('Usuário já existia: senha atualizada e e-mail confirmado.');
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: SAAS_ADMIN_EMAIL,
      password: SAAS_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: SAAS_ADMIN_NAME,
        organization_slug: TENANT_SLUG,
        user_type: 'saas_admin',
      },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('Usuário criado no Auth.');
  }

  const { error: profileErr } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: SAAS_ADMIN_EMAIL,
      full_name: SAAS_ADMIN_NAME,
      user_type: 'saas_admin',
      consultant_id: null,
      client_id: null,
      organization_id: org.id,
    },
    { onConflict: 'id' }
  );

  if (profileErr) throw profileErr;

  console.log('Perfil definido como saas_admin na org', TENANT_SLUG + '.');
  console.log(`Login: ${SAAS_ADMIN_EMAIL} / ${SAAS_ADMIN_PASSWORD}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
