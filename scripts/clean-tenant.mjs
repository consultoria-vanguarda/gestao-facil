/**
 * Exibe o SQL de limpeza do tenant (preserva usuários e arquivos de storage).
 *
 * A limpeza roda em supabase/scripts/clean-tenant.sql no SQL Editor do Supabase.
 *
 * Requer no .env.local (apenas para resolver o slug → org id):
 *   VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   npm run clean:tenant
 *   npm run clean:tenant -- vanguarda
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const DEFAULT_SLUG = 'vanguarda';

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

function parseArgs(argv) {
  const args = argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--')) || DEFAULT_SLUG;
  return { slug };
}

async function main() {
  const { slug } = parseArgs(process.argv);
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Defina VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) {
    throw new Error(`Tenant "${slug}" não encontrado.`);
  }

  console.log(`Tenant: ${org.name} (${org.slug})`);
  console.log(`Organization ID: ${org.id}`);
  console.log('Preserva: usuários, organization_settings, configs de seed e arquivos no storage.\n');

  const sqlPath = join(root, 'supabase', 'scripts', 'clean-tenant.sql');
  console.log('Execute no Supabase → SQL Editor:\n');
  console.log(
    readFileSync(sqlPath, 'utf8').replace(
      "target_slug TEXT := 'vanguarda';",
      `target_slug TEXT := '${slug.replace(/'/g, "''")}';`
    )
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
