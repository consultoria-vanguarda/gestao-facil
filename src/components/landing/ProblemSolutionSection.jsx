import { motion } from 'framer-motion';
import SectionContainer from './SectionContainer';
import { XCircle, CheckCircle2 } from 'lucide-react';

const comparison = [
  {
    tag: 'Antes',
    subtitle: 'Como a maioria das consultorias opera',
    points: [
      'Atendimentos espalhados entre WhatsApp, planilha e e-mail.',
      'Dificuldade para acompanhar escopo, horas e entregas por projeto.',
      'Financeiro desconectado da execução e sem previsibilidade de resultado.',
    ],
    card: 'border-rose-200 bg-gradient-to-br from-rose-50/80 to-white',
    tagColor: 'text-rose-600',
    iconColor: 'text-rose-400',
    Icon: XCircle,
    x: -48,
    delay: 0.2,
  },
  {
    tag: 'Depois',
    subtitle: 'Com o Gestão Ágil',
    points: [
      'Operação centralizada com projetos, clientes, consultores e tarefas.',
      'Acompanhamento claro de progresso, agenda, documentos e comunicação.',
      'Financeiro integrado com DRE, despesas, faturamento e relatórios.',
    ],
    card: 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white',
    tagColor: 'text-emerald-600',
    iconColor: 'text-emerald-500',
    Icon: CheckCircle2,
    x: 48,
    delay: 0.32,
  },
];

export default function ProblemSolutionSection() {
  return (
    <SectionContainer id="sobre" className="bg-slate-50/60">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-12 space-y-3 text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">A solução</p>
        <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
          Da gestão reativa para uma{' '}
          <span className="bg-gradient-to-r from-[#1e3a5f] to-blue-600 bg-clip-text text-transparent">
            operação previsível
          </span>
        </h2>
        <p className="mx-auto max-w-3xl text-slate-500">
          Você mantém o atendimento consultivo e ganha estrutura para executar com método, visibilidade e
          controle.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {comparison.map(({ tag, subtitle, points, card, tagColor, iconColor, Icon, x, delay }) => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, x }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={`rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-lg md:p-8 ${card}`}
          >
            <div className="mb-5 flex items-center gap-2">
              <Icon size={20} className={iconColor} />
              <div>
                <span className={`text-sm font-bold ${tagColor}`}>{tag}</span>
                <p className="text-xs text-slate-400">{subtitle}</p>
              </div>
            </div>
            <ul className="space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                  <Icon size={15} className={`mt-0.5 shrink-0 ${iconColor}`} />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </SectionContainer>
  );
}
