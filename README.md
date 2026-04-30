# Gestão Ágil

Aplicação web (Vite + React) com Supabase: multi-tenant, autenticação e módulos de consultoria, financeiro e relatórios.

## Desenvolvimento

1. Clone o repoositório e entre na pasta do projeto.
2. Instale dependências: `npm install`
3. Crie `.env.local` com as variáveis do Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.). Opcional: `VITE_SUPABASE_STORAGE_BUCKET` se o bucket público de arquivos tiver outro nome no painel.

Variáveis opcionais usadas pelo shell de parâmetros da app: `VITE_APP_ID`, `VITE_APP_BASE_URL`, `VITE_FUNCTIONS_VERSION`.

### Stripe (billing por conta)

No Supabase Functions, configure os secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ENTERPRISE`

Deploy das funções:

- `supabase functions deploy billing-create-checkout-session`
- `supabase functions deploy billing-create-portal-session`
- `supabase functions deploy stripe-webhook`

4. Execute: `npm run dev`

## Scripts

- `npm run build` — build de proodução
- `npm run lint` — ESLint
- `npm run typecheck` — verificação TypeScript
