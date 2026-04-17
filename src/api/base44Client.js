import { supabase } from './supabaseClient';
import { requireCurrentOrganizationId } from '@/lib/organizationScope';

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
    const row = { ...data };
    if (!row.id) row.id = generateId();
    row.organization_id = orgId;
    const { data: created, error } = await supabase
      .from(tableName)
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return created;
  };

  const update = async (id, data) => {
    const orgId = requireCurrentOrganizationId();
    const { data: updated, error } = await supabase
      .from(tableName)
      .update({
        ...data,
        organization_id: orgId,
        updated_date: data?.updated_date ?? new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('*')
      .single();
    if (error) throw error;
    return updated;
  };

  const remove = async (id) => {
    const orgId = requireCurrentOrganizationId();
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
    const rows = (records || []).map((r) => ({ ...r }));
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

  const objectPath = `public/${generateId()}_${encodeURIComponent(file.name)}`;
  const { error: uploadError } = await supabase
    .storage
    .from('base44-prod')
    .upload(objectPath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('base44-prod').getPublicUrl(objectPath);
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

export const base44 = {
  auth: {
    me: async () => {
      requireCurrentOrganizationId();
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
        .select('*, organization:organizations(id, name, slug, custom_domain)')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

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
          organization_custom_domain: null,
        };
      }

      return {
        id: user.id,
        email: user.email,
        full_name: profile.full_name ?? user.email,
        user_type: profile.user_type ?? 'admin',
        consultant_id: profile.consultant_id,
        client_id: profile.client_id,
        organization_id: profile.organization_id ?? null,
        organization_name: profile.organization?.name ?? null,
        organization_slug: profile.organization?.slug ?? null,
        organization_custom_domain: profile.organization?.custom_domain ?? null,
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

  // SDK Base44 original enviava telemetria de navegação; aqui é no-op para não quebrar o app.
  appLogs: {
    logUserInApp: async () => {},
  },
};
