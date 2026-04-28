import SectionContainer from './SectionContainer';

const comparison = [
  {
    title: 'Antes',
    points: [
      'Atendimentos espalhados entre WhatsApp, planilha e e-mail.',
      'Dificuldade para acompanhar escopo, horas e entregas por projeto.',
      'Financeiro desconectado da execução e sem previsibilidade de resultado.',
    ],
    tone: 'border-rose-200 bg-rose-50',
  },
  {
    title: 'Depois',
    points: [
      'Operação centralizada com projetos, clientes, consultores e tarefas.',
      'Acompanhamento claro de progresso, agenda, documentos e comunicação.',
      'Financeiro integrado com DRE, despesas, faturamento e relatórios.',
    ],
    tone: 'border-emerald-200 bg-emerald-50',
  },
];

export default function ProblemSolutionSection() {
  return (
    <SectionContainer id="sobre" className="bg-slate-50">
      <div className="mb-12 space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">A solução</p>
        <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Da gestão reativa para uma operação previsível</h2>
        <p className="mx-auto max-w-3xl text-slate-600">
          Você mantém o atendimento consultivo e ganha estrutura para executar com método, visibilidade e controle.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {comparison.map((card) => (
          <div key={card.title} className={`rounded-2xl border p-6 md:p-8 ${card.tone}`}>
            <h3 className="mb-4 text-2xl font-bold text-slate-900">{card.title}</h3>
            <ul className="space-y-3 text-slate-700">
              {card.points.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionContainer>
  );
}
