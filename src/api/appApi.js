import { supabase } from './supabaseClient';
import { requireCurrentOrganizationId, requireCurrentOrganizationWritable } from '@/lib/organizationScope';
import { getPublicStorageBucket } from '@/lib/supabasePublicStorage';

const generateId = () => {
  // IDs do schema são `VARCHAR(32)` sem hífen.
  // UUID v4 sem hífen => 32 chars hex.
  return globalThis.crypto.randomUUID().replace(/-/g, '');
};

const parseSort = (sort) => {
  if (!sort) return null;
  const s = String(sort);
  const direction = s.startsWith('-') ? 'desc' : 'asc';
  const column = s.startsWith('-') ? s.slice(1) : s;
  return { column, direction };
};

const applyFilters = (query, filters = {}) => {
  const validFilters = Object.entries(filters || {}).filter(
    ([, v]) => v !== undefined
  );
  for (const [key, value] of validFilters) {
    if (value === null) {
      query = query.is(key, null);
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
};

const getMissingColumnFromError = (error) => {
  const message = error?.message || '';
  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] || null;
};

/** Ajusta payload quando o banco ainda não tem colunas novas (ex.: antes da migration). */
const applyMissingColumnFallback = (row, missingColumn) => {
  const fallback = { ...row };
  delete fallback[missingColumn];

  if (missingColumn === 'max_hours_per_day' && row.max_hours_per_day != null) {
    fallback.hours_per_day = row.max_hours_per_day;
  }

  return fallback;
};

/** '' em FKs opcionais quebra INSERT/UPDATE (ex.: project_id REFERENCES). */
const normalizeEmptyStringsToNull = (data = {}) => {
  const row = { ...data };
  for (const [key, value] of Object.entries(row)) {
    if (value === '') row[key] = null;
  }
  return row;
};

export const formatEntitySaveError = (error) => {
  const message = error?.message || '';
  if (message.includes('max_hours_per_day')) {
    return 'Falha ao salvar: atualize o banco de dados (migration max_hours_per_day) ou tente novamente.';
  }
  if (
    message.includes('somente leitura')
    || message.includes('read_only')
    || message.includes('subscription')
    || error?.code === '42501'
  ) {
    return 'Não foi possível salvar: organização em modo somente leitura ou assinatura inativa.';
  }
  if (message.includes('organization_id')) {
    return 'Não foi possível salvar: organização não identificada. Recarregue a página e tente novamente.';
  }
  return message || 'Erro ao salvar. Tente novamente.';
};

const createEntity = (tableName) => {
  const list = async (sort) => {
    const orgId = requireCurrentOrganizationId();
    let query = supabase
      .from(tableName)
      .select('*')
      .eq('organization_id', orgId);
    const s = parseSort(sort);
    if (s) query = query.order(s.column, { ascending: s.direction === 'asc' });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const filter = async (filters, sort) => {
    const orgId = requireCurrentOrganizationId();
    let query = supabase
      .from(tableName)
      .select('*')
      .eq('organization_id', orgId);
    query = applyFilters(query, filters);
    const s = parseSort(sort);
    if (s) query = query.order(s.column, { ascending: s.direction === 'asc' });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const create = async (data) => {
    const orgId = requireCurrentOrganizationId();
    requireCurrentOrganizationWritable();
    const row = normalizeEmptyStringsToNull(data);
    if (!row.id) row.id = generateId();
    row.organization_id = orgId;

    let payload = row;
    let result = await supabase.from(tableName).insert(payload).select('*').single();

    if (result.error?.code === 'PGRST204') {
      const missingColumn = getMissingColumnFromError(result.error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        payload = applyMissingColumnFallback(payload, missingColumn);
        result = await supabase.from(tableName).insert(payload).select('*').single();
      }
    }

    if (result.error) throw result.error;
    return result.data;
  };

  const update = async (id, data) => {
    const orgId = requireCurrentOrganizationId();
    requireCurrentOrganizationWritable();

    let payload = {
      ...normalizeEmptyStringsToNull(data),
      organization_id: orgId,
      updated_date: data?.updated_date ?? new Date().toISOString(),
    };

    let result = await supabase
      .from(tableName)
      .update(payload)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('*')
      .single();

    if (result.error?.code === 'PGRST204') {
      const missingColumn = getMissingColumnFromError(result.error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        payload = applyMissingColumnFallback(payload, missingColumn);
        result = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('*')
          .single();
      }
    }

    if (result.error) throw result.error;
    return result.data;
  };

  const remove = async (id) => {
    const orgId = requireCurrentOrganizationId();
    requireCurrentOrganizationWritable();
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);
    if (error) throw error;
    return true;
  };

  const bulkCreate = async (records) => {
    const orgId = requireCurrentOrganizationId();
    requireCurrentOrganizationWritable();
    const rows = (records || []).map((r) => normalizeEmptyStringsToNull(r));
    for (const row of rows) {
      if (!row.id) row.id = generateId();
      row.organization_id = orgId;
    }
    const { error } = await supabase.from(tableName).insert(rows);
    if (error) throw error;
    return true;
  };

  return {
    list,
    filter,
    create,
    update,
    delete: remove,
    bulkCreate,
  };
};

const storageUploadFile = async ({ file }) => {
  if (!file) throw new Error('Arquivo não informado');

  const bucket = getPublicStorageBucket();
  const objectPath = `public/${generateId()}_${encodeURIComponent(file.name)}`;
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(objectPath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  // Mantemos o formato do front antigo: `{ file_url }`
  return { file_url: data.publicUrl };
};

const getFunctionErrorMessage = async (error, functionName) => {
  let message = error?.message || `Erro ao executar função ${functionName}`;
  const status = error?.context?.status;

  try {
    const details = await error?.context?.json?.();
    const backendMessage = details?.error || details?.message;
    if (backendMessage) {
      message = backendMessage;
    }
  } catch (_) {
    // Ignora parse de body quando não houver JSON.
  }

  if (status) {
    message = `[${status}] ${message}`;
  }

  return message;
};

const invokeFunctionWithAnonFallback = async (name, payload) => {
  const firstTry = await supabase.functions.invoke(name, { body: payload });
  if (!firstTry.error) return firstTry;

  const status = firstTry.error?.context?.status;
  if (status !== 401) return firstTry;

  // Em alguns cenários o gateway exige Authorization explícito.
  // Fazemos retry com anon key para evitar falso 401.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return firstTry;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload ?? {}),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: data?.error || data?.message || `Erro ao executar função ${name}`,
          context: {
            status: res.status,
            json: async () => data,
          },
        },
      };
    }

    return { data, error: null };
  } catch {
    return firstTry;
  }
};

/**
 * Chama Edge Function com JWT do usuário (Authorization).
 * Mensagens explícitas quando a função não está deployada (404) ou há falha de rede.
 */
export async function invokeEdgeFunctionWithSession(functionName, body) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const url = `${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/${functionName}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch (e) {
    throw new Error(
      `Não foi possível contactar a Edge Function "${functionName}". ` +
        `Confirme o deploy no Supabase: supabase functions deploy ${functionName}. ` +
        (e?.message || '')
    );
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (res.status === 404) {
    throw new Error(
      `Edge Function "${functionName}" não encontrada (404). Deploy: supabase functions deploy ${functionName}`
    );
  }

  const extractMessage = (body) => {
    if (!body || typeof body !== 'object') return null;
    if (typeof body.error === 'string') return body.error;
    if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string') {
      return body.error.message;
    }
    if (typeof body.message === 'string') return body.message;
    if (typeof body.msg === 'string') return body.msg;
    if (typeof body.code === 'number' && typeof body.message === 'string') {
      return body.message;
    }
    return null;
  };

  const isGenericEdgeMessage = (s) =>
    typeof s === 'string' && /non-2xx|Edge Function returned/i.test(s);

  if (!res.ok) {
    const fromJson = extractMessage(json);
    const fromRaw =
      typeof json?.raw === 'string' && json.raw.length > 0 && json.raw.length < 800 && !json.raw.trim().startsWith('<')
        ? json.raw.trim()
        : null;
    let msg =
      fromJson ||
      fromRaw ||
      `${res.status} ${res.statusText || ''}`.trim() ||
      'Erro desconhecido na Edge Function';
    if (isGenericEdgeMessage(msg) || (!fromJson && !fromRaw)) {
      const snippet = (text || '').trim().slice(0, 900);
      msg = snippet
        ? `HTTP ${res.status} — ${snippet}`
        : `HTTP ${res.status} — ${msg}`;
    } else {
      msg = `HTTP ${res.status} — ${msg}`;
    }
    throw new Error(msg);
  }
  if (json?.error) {
    const m = extractMessage(json) || json.error;
    throw new Error(typeof m === 'string' ? m : JSON.stringify(m));
  }
  return json;
}

export const api = {
  auth: {
    me: async () => {
      // Não usar requireCurrentOrganizationId() aqui: o escopo global pode ainda não estar
      // sincronizado com o TenantContext (ordem de efeitos), e o perfil define a org.
      // getUser() sem sessão local dispara AuthSessionMissingError; getSession() só lê o storage.
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;
      const user = session?.user;
      if (!user) {
        const e = new Error('Not authenticated');
        e.status = 401;
        throw e;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, organization:organizations(id, name, slug, subscription_status, subscription_plan, subscription_current_period_end, read_only_reason)')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const normalizeProfileUserType = (raw) => {
        if (raw == null || String(raw).trim() === '') return 'admin';
        return String(raw).trim().toLowerCase();
      };

      if (!profile) {
        // Se não existir profile, ainda assim devolvemos user_type=admin (fallback).
        return {
          id: user.id,
          email: user.email,
          full_name: user.email,
          user_type: 'admin',
          consultant_id: null,
          client_id: null,
          organization_id: null,
          organization_name: null,
          organization_slug: null,
          organization_subscription_status: null,
          organization_subscription_plan: null,
          organization_subscription_current_period_end: null,
          organization_read_only_reason: null,
        };
      }

      return {
        id: user.id,
        email: user.email,
        full_name: profile.full_name ?? user.email,
        user_type: normalizeProfileUserType(profile.user_type),
        consultant_id: profile.consultant_id,
        client_id: profile.client_id,
        organization_id: profile.organization_id ?? null,
        organization_name: profile.organization?.name ?? null,
        organization_slug: profile.organization?.slug ?? null,
        organization_subscription_status: profile.organization?.subscription_status ?? null,
        organization_subscription_plan: profile.organization?.subscription_plan ?? null,
        organization_subscription_current_period_end: profile.organization?.subscription_current_period_end ?? null,
        organization_read_only_reason: profile.organization?.read_only_reason ?? null,
      };
    },

    logout: async (redirectUrl) => {
      await supabase.auth.signOut();
      if (redirectUrl) window.location.href = redirectUrl;
    },

    redirectToLogin: (redirectUrl) => {
      // Depois de logar, o usuário volta para a mesma URL (quando fizer sentido).
      const url = redirectUrl || window.location.href;
      const encoded = encodeURIComponent(url);
      window.location.href = `/login?redirect=${encoded}`;
    },

    updateMe: async (data) => {
      const orgId = requireCurrentOrganizationId();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        const e = new Error('Not authenticated');
        e.status = 401;
        throw e;
      }

      const full_name = data?.full_name ?? null;
      const { error } = await supabase
        .from('profiles')
        .update({ full_name, organization_id: orgId })
        .eq('id', user.id)
        .eq('organization_id', orgId);

      if (error) throw error;
      return true;
    },
  },

  entities: {
    Consultant: createEntity('consultant'),
    Client: createEntity('client'),
    Project: createEntity('project'),
    ProjectSchedule: createEntity('project_schedule'),
    Task: createEntity('task'),
    Document: createEntity('document'),
    TimeEntry: createEntity('time_entry'),
    Expense: createEntity('expense'),
    Message: createEntity('message'),
    ProjectReceivable: createEntity('project_receivable'),
    ProjectPayable: createEntity('project_payable'),
    ServiceReport: createEntity('service_report'),
    ServiceModel: createEntity('service_model'),
    ServiceAreaConfig: createEntity('service_area_config'),
    FinancialAccount: createEntity('financial_account'),
    AccountTransaction: createEntity('account_transaction'),
    ChartOfAccounts: createEntity('chart_of_accounts'),
    TaxRate: createEntity('tax_rate'),
    BillingEntry: createEntity('billing_entry'),
    TaxExpenseEntry: createEntity('tax_expense_entry'),
  },

  integrations: {
    Core: {
      UploadFile: storageUploadFile,
    },
  },

  functions: {
    invoke: async (name, payload) => {
      if (name === 'parsePublicPoliciesPdf') {
        // parse B => upload funcionando, parsing desativado.
        return {
          data: {
            success: false,
            error: 'Parsing de PDF desativado (modo local sem IA).',
          },
        };
      }
      if (name === 'parseViabilityPdf') {
        const { data, error } = await supabase.functions.invoke(name, { body: payload });
        if (error) {
          const detailedMessage = await getFunctionErrorMessage(error, name);
          return {
            data: {
              success: false,
              error: detailedMessage,
            },
          };
        }
        return { data };
      }
      if (name === 'googleDistanceKm') {
        const { data, error } = await invokeFunctionWithAnonFallback(name, payload);
        if (error) {
          const detailedMessage = await getFunctionErrorMessage(error, name);
          return {
            data: {
              success: false,
              error: detailedMessage,
            },
          };
        }
        return { data };
      }

      // Fallback genérico para outras funções server-side
      const { data, error } = await supabase.functions.invoke(name, { body: payload });
      if (error) throw new Error(error.message || `Função não suportada: ${name}`);
      return { data };
    },
  },

  /** Telemetria de navegação (placeholder; não envia dados). */
  appLogs: {
    logUserInApp: async () => {},
  },

  billing: {
    getMySubscription: async () => {
      const orgId = requireCurrentOrganizationId();
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          billing_email,
          stripe_customer_id,
          stripe_subscription_id,
          subscription_status,
          subscription_plan,
          subscription_current_period_end,
          read_only_reason
        `)
        .eq('id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    createCheckoutSession: async ({ planKey, successUrl, cancelUrl }) => {
      return invokeEdgeFunctionWithSession('billing-create-checkout-session', {
        plan_key: planKey,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
    },

    createPortalSession: async ({ returnUrl }) => {
      return invokeEdgeFunctionWithSession('billing-create-portal-session', {
        return_url: returnUrl,
      });
    },
  },
};
