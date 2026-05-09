/**
 * Chat streaming para o app (Gemini free tier ou outros provedores via env).
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets ou CLI):
 *   LLM_PROVIDER          google | openai | anthropic   (default: google)
 *   LLM_MODEL             ex.: gemini-2.0-flash, gpt-4o-mini, claude-3-5-haiku-latest
 *   GOOGLE_GENERATIVE_AI_API_KEY   ou GEMINI_API_KEY (Google)
 *   OPENAI_API_KEY        (OpenAI)
 *   ANTHROPIC_API_KEY     (Anthropic)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { convertToModelMessages, streamText } from 'npm:ai@6.0.177';
import { createAnthropic } from 'npm:@ai-sdk/anthropic@3.0.76';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@3.0.71';
import { createOpenAI } from 'npm:@ai-sdk/openai@3.0.63';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `Você é o assistente do sistema Gestão Ágil (consultoria e projetos).
Ajude o usuário a entender funcionalidades do app, boas práticas de gestão de projetos e consultoria,
e a estruturar rascunhos de propostas ou documentos quando pedido.
Responda em português do Brasil, de forma objetiva e profissional.
Se não souber algo específico sobre os dados internos da organização do usuário, diga que não tem acesso e sugira onde encontrar no sistema.`;

function resolveLanguageModel() {
  const provider = (Deno.env.get('LLM_PROVIDER') ?? 'google').toLowerCase().trim();
  const modelId = (Deno.env.get('LLM_MODEL') ?? 'gemini-2.0-flash').trim();

  if (provider === 'google') {
    const apiKey =
      Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() ??
      Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('Configure GOOGLE_GENERATIVE_AI_API_KEY ou GEMINI_API_KEY para o provedor google.');
    }
    const genAI = createGoogleGenerativeAI({ apiKey });
    return genAI(modelId);
  }

  if (provider === 'openai') {
    const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!apiKey) throw new Error('Configure OPENAI_API_KEY para o provedor openai.');
    const openai = createOpenAI({ apiKey });
    return openai(modelId);
  }

  if (provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
    if (!apiKey) throw new Error('Configure ANTHROPIC_API_KEY para o provedor anthropic.');
    const anthropic = createAnthropic({ apiKey });
    return anthropic(modelId);
  }

  throw new Error(`LLM_PROVIDER inválido: "${provider}". Use google, openai ou anthropic.`);
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
    if (!supabaseUrl || !anonKey) {
      return Response.json({ error: 'Servidor mal configurado.' }, { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Não autenticado.' }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userErr,
    } = await anonClient.auth.getUser(token);

    if (userErr || !user?.id) {
      return Response.json(
        { error: userErr?.message ?? 'Sessão inválida. Faça login novamente.' },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = await req.json().catch(() => null);
    const uiMessages = body?.messages;
    if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
      return Response.json({ error: 'Envie o histórico em "messages".' }, { status: 400, headers: corsHeaders });
    }

    const model = resolveLanguageModel();
    const modelMessages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      maxOutputTokens: 4096,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse({
      headers: {
        ...corsHeaders,
      },
    });
  } catch (e) {
    console.error('ai-chat:', e);
    const message = e instanceof Error ? e.message : 'Erro ao gerar resposta.';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
