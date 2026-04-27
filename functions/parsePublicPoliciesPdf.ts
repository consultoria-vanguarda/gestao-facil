import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file_url, num_phases } = body;
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // First call: extract header info + phases 1-50
    const headerResult = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é um extrator de dados de documentos SEBRAE. Analise este documento PDF de "Informações da Demanda".

Extraia as informações gerais do documento:
- project_name: conteúdo do campo "Projeto" na seção "Projeto e Ação"
- total_hours: total de horas como número puro
- total_phases: CONTE o número TOTAL de fases/itens na tabela de fases do documento. Seja preciso. NÃO inclua o "Histórico da Demanda".

Extraia as fases de 1 a 50 (IGNORE qualquer seção chamada "Histórico da Demanda"):
Para cada fase: phase_number (número inteiro), description (coluna Produto), hours (horas como número), value (valor da fase como número puro sem R$ e sem pontos, ex: 1452.00), start_date (SOMENTE a PRIMEIRA data do campo "Previsto" no formato YYYY-MM-DD. Ex: "De 01/03/2026 até 31/03/2026" → retorne "2026-03-01"), type (PRESENCIAL ou DISTANCIA).`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          project_name: { type: "string" },
          total_hours: { type: "number" },
          total_phases: { type: "number" },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                phase_number: { type: "number" },
                description: { type: "string" },
                hours: { type: "number" },
                value: { type: "number" },
                start_date: { type: "string" },
                type: { type: "string" }
              }
            }
          }
        }
      }
    });

    const totalPhases = num_phases || headerResult?.total_phases || 50;
    console.log(`Total phases detected: ${totalPhases}`);

    // Collect phases from first call
    const allPhasesMap = new Map();
    if (Array.isArray(headerResult?.phases)) {
      for (const p of headerResult.phases) {
        if (p.phase_number) allPhasesMap.set(p.phase_number, p);
      }
    }

    // Process remaining phases in batches of 50, sequentially to avoid memory issues
    const batchSize = 50;
    let start = 51;
    while (start <= totalPhases) {
      const end = Math.min(start + batchSize - 1, totalPhases);

      const result = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é um extrator de dados de documentos SEBRAE. Analise este documento PDF de "Informações da Demanda".

Extraia APENAS as fases de número ${start} até ${end} (inclusive). IGNORE qualquer seção chamada "Histórico da Demanda".
Se não existirem fases nesse intervalo, retorne um array vazio.

Para cada fase: phase_number (número inteiro), description (coluna Produto), hours (horas como número), value (valor da fase como número puro sem R$ e sem pontos, ex: 1452.00), start_date (SOMENTE a PRIMEIRA data do campo "Previsto" no formato YYYY-MM-DD. Ex: "De 01/03/2026 até 31/03/2026" → "2026-03-01"), type (PRESENCIAL ou DISTANCIA).

IMPORTANTE: Retorne SOMENTE fases com phase_number entre ${start} e ${end}. Não pule nenhuma.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            phases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  phase_number: { type: "number" },
                  description: { type: "string" },
                  hours: { type: "number" },
                  value: { type: "number" },
                  start_date: { type: "string" },
                  type: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (Array.isArray(result?.phases)) {
        for (const p of result.phases) {
          if (p.phase_number) allPhasesMap.set(p.phase_number, p);
        }
      }

      start = end + 1;
    }

    const allPhases = Array.from(allPhasesMap.values())
      .sort((a, b) => (a.phase_number || 0) - (b.phase_number || 0));

    console.log(`Total phases extracted: ${allPhases.length}`);

    const totalValue = allPhases.reduce((sum, p) => sum + (p.value || 0), 0);

    const mergedResult = {
      project_name: headerResult?.project_name,
      total_value: totalValue,
      total_hours: headerResult?.total_hours,
      total_phases: totalPhases,
      phases: allPhases
    };

    return Response.json({ success: true, data: mergedResult });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});