/**
 * Gera rascunho de projeto a partir de áudio (Gemini multimodal) ou texto colado.
 *
 * Secrets:
 *   GOOGLE_GENERATIVE_AI_API_KEY ou GEMINI_API_KEY (obrigatório)
 *   PROJECT_DRAFT_MODEL (opcional, default: gemini-2.0-flash)
 *
 * Body JSON:
 *   { "storage_path": "uuid-org/file.webm", "bucket": "project-draft-audio" }
 *   ou { "text_note": "ata ou transcrição..." } (sem áudio)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const DEFAULT_BUCKET = 'project-draft-audio';
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function mimeFromPath(objectPath: string): string {
  const p = objectPath.toLowerCase();
  if (p.endsWith('.webm')) return 'audio/webm';
  if (p.endsWith('.mp3')) return 'audio/mpeg';
  if (p.endsWith('.wav')) return 'audio/wav';
  if (p.endsWith('.m4a')) return 'audio/mp4';
  if (p.endsWith('.ogg')) return 'audio/ogg';
  if (p.endsWith('.opus')) return 'audio/opus';
  return 'audio/webm';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function defaultTemplateFallback(): string {
  return [
    'Modelo padrão (edite em Configurações > IA / Rascunho de projeto):',
    '- Objetivo do projeto',
    '- Necessidades do cliente',
    '- Detalhamento do serviço',
    '- Produto final a ser entregue',
    '- Atividades sugeridas (descrição, horas, modalidade, forma de entrega quando aplicável)',
  ].join('\n');
}

function buildJsonPrompt(orgTemplate: string | null): string {
  const tmpl = (orgTemplate && orgTemplate.trim()) || defaultTemplateFallback();
  return `Você é um assistente para gestão de projetos de consultoria (Sebrae / Gestão Ágil).

TAREFA:
1) Se houver ÁUDIO: transcreva o conteúdo falado com fidelidade útil (pt-BR). Se houver apenas TEXTO colado, use-o como fonte.
2) Com base na transcrição/texto e no MODELO DA ORGANIZAÇÃO abaixo, preencha um RASCUNHO de projeto alinhado ao modelo.
3) NÃO invente IDs de cliente ou consultor. Se um nome de empresa/pessoa for mencionado, coloque em suggested_client_company (texto livre).
4) project_type deve ser um destes valores quando fizer sentido: diagnostic | consulting | instructional | lecture | public_policies | other — senão use other ou deixe vazio.

MODELO DA ORGANIZAÇÃO (seções e tom a respeitar):
${tmpl}

SAÍDA: responda APENAS um único objeto JSON válido (sem markdown), com esta forma exata:
{
  "transcript": string,
  "draft": {
    "project_type": string,
    "area": string,
    "subarea": string,
    "custom_area": string,
    "custom_subarea": string,
    "objective": string,
    "client_needs": string,
    "service_detail": string,
    "produto_final": string,
    "activities": [ { "description": string, "days": string, "hours": string, "modality": string, "delivery": string } ],
    "notes": string,
    "suggested_client_company": string
  },
  "warnings": string[]
}

Regras dos campos:
- Campos desconhecidos: use string vazia "" ou array vazio [].
- activities: liste etapas mencionadas na reunião; estime horas/dias só quando houver base na conversa.
- warnings: avisos (ex.: áudio ilegível, informação insuficiente).`;
}

async function geminiGenerateJson(opts: {
  apiKey: string;
  model: string;
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}): Promise<Record<string, unknown>> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: opts.parts.map((p) => {
          if (p.inlineData) {
            return {
              inline_data: {
                mime_type: p.inlineData.mimeType,
                data: p.inlineData.data,
              },
            };
          }
          return { text: p.text ?? '' };
        }),
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (raw?.error as { message?: string } | undefined)?.message ||
      JSON.stringify(raw).slice(0, 600);
    throw new Error(`Gemini: ${msg}`);
  }

  const candidates = raw?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') {
    throw new Error(
      'Resposta vazia do Gemini (conteúdo bloqueado ou limite excedido). Tente texto menor ou outro arquivo.'
    );
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Gemini não retornou JSON válido.');
  }
}

function normalizePayload(parsed: Record<string, unknown>) {
  const draftRaw = (parsed.draft as Record<string, unknown>) || {};
  const activitiesIn = Array.isArray(draftRaw.activities) ? draftRaw.activities : [];
  const activities = activitiesIn.map((a) => {
    const o = (a as Record<string, unknown>) || {};
    const toStr = (v: unknown) => (v == null ? '' : String(v));
    return {
      description: toStr(o.description),
      days: toStr(o.days),
      hours: toStr(o.hours),
      modality: toStr(o.modality),
      delivery: toStr(o.delivery),
    };
  });

  const draft = {
    project_type: String(draftRaw.project_type ?? '').trim(),
    area: String(draftRaw.area ?? '').trim(),
    subarea: String(draftRaw.subarea ?? '').trim(),
    custom_area: String(draftRaw.custom_area ?? '').trim(),
    custom_subarea: String(draftRaw.custom_subarea ?? '').trim(),
    objective: String(draftRaw.objective ?? '').trim(),
    client_needs: String(draftRaw.client_needs ?? '').trim(),
    service_detail: String(draftRaw.service_detail ?? '').trim(),
    produto_final: String(draftRaw.produto_final ?? '').trim(),
    activities,
    notes: String(draftRaw.notes ?? '').trim(),
    suggested_client_company: String(draftRaw.suggested_client_company ?? '').trim(),
  };

  const warningsRaw = parsed.warnings;
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.map((w) => String(w))
    : [];

  return {
    transcript: String(parsed.transcript ?? '').trim(),
    draft,
    warnings,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const apiKey =
      Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() ??
      Deno.env.get('GEMINI_API_KEY')?.trim();

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return Response.json({ error: 'Servidor mal configurado.' }, { status: 500, headers: corsHeaders });
    }
    if (!apiKey) {
      return Response.json(
        { error: 'Configure GOOGLE_GENERATIVE_AI_API_KEY ou GEMINI_API_KEY.' },
        { status: 500, headers: corsHeaders }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Não autenticado.' }, { status: 401, headers: corsHeaders });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userErr,
    } = await anonClient.auth.getUser(jwt);
    if (userErr || !user?.id) {
      return Response.json(
        { error: userErr?.message ?? 'Sessão inválida.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: profile, error: profileErr } = await userClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profile?.organization_id) {
      return Response.json({ error: 'Perfil ou organização não encontrados.' }, { status: 400, headers: corsHeaders });
    }

    const orgId = String(profile.organization_id);

    const { data: settingsRow } = await userClient
      .from('organization_settings')
      .select('project_draft_template')
      .eq('organization_id', orgId)
      .maybeSingle();

    const template = settingsRow?.project_draft_template ?? null;
    const jsonPrompt = buildJsonPrompt(typeof template === 'string' ? template : null);

    const body = (await req.json().catch(() => ({}))) as {
      storage_path?: string;
      bucket?: string;
      text_note?: string;
    };

    const textNote = typeof body.text_note === 'string' ? body.text_note.trim() : '';
    const storagePath = typeof body.storage_path === 'string' ? body.storage_path.trim() : '';
    const bucket = (typeof body.bucket === 'string' ? body.bucket.trim() : '') || DEFAULT_BUCKET;

    if (!textNote && !storagePath) {
      return Response.json(
        { error: 'Envie storage_path (áudio já enviado ao Storage) ou text_note (texto da reunião).' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (storagePath) {
      const prefix = `${orgId}/`;
      if (!storagePath.startsWith(prefix)) {
        return Response.json(
          { error: 'Caminho do arquivo inválido para esta organização.' },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const model = (Deno.env.get('PROJECT_DRAFT_MODEL') ?? 'gemini-2.0-flash').trim();

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (storagePath) {
      const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(storagePath);
      if (dlErr || !blob) {
        console.error('ai-project-draft download:', dlErr);
        return Response.json({ error: 'Não foi possível ler o arquivo de áudio.' }, { status: 400, headers: corsHeaders });
      }

      const buf = new Uint8Array(await blob.arrayBuffer());
      if (buf.byteLength > MAX_AUDIO_BYTES) {
        return Response.json(
          { error: `Áudio acima do limite (${MAX_AUDIO_BYTES} bytes). Comprima ou envie trecho menor.` },
          { status: 400, headers: corsHeaders }
        );
      }

      const mime = mimeFromPath(storagePath);
      parts.push({
        inlineData: {
          mimeType: mime,
          data: bytesToBase64(buf),
        },
      });
    }

    if (textNote) {
      parts.push({
        text: `TEXTO ADICIONAL / ATA / TRANSCRIÇÃO COLADA PELO USUÁRIO:\n${textNote}\n\n---\n${jsonPrompt}`,
      });
    } else {
      parts.push({ text: jsonPrompt });
    }

    const parsed = await geminiGenerateJson({ apiKey, model, parts });
    const normalized = normalizePayload(parsed);

    return Response.json(normalized, { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error('ai-project-draft:', e);
    const message = e instanceof Error ? e.message : 'Erro ao gerar rascunho.';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
