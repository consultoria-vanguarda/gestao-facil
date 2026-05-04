import { motion } from 'framer-motion';
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
    cardBg: '#14101F',
    cardBorder: 'rgba(236,234,255,0.06)',
    tagColor: '#6E6884',
    iconColor: '#6E6884',
    Icon: XCircle,
    x: -48,
    delay: 0.2,
  },
  {
    tag: 'Depois',
    subtitle: 'Com o GestãoUP',
    points: [
      'Operação centralizada com projetos, clientes, consultores e tarefas.',
      'Acompanhamento claro de progresso, agenda, documentos e comunicação.',
      'Financeiro integrado com DRE, despesas, faturamento e relatórios.',
    ],
    cardBg: '#14101F',
    cardBorder: 'rgba(124,92,255,0.25)',
    tagColor: '#7C5CFF',
    iconColor: '#7C5CFF',
    Icon: CheckCircle2,
    x: 48,
    delay: 0.32,
  },
];

export default function ProblemSolutionSection() {
  return (
    <section id="sobre" className="border-t border-[rgba(236,234,255,0.08)] px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-16 space-y-4 text-center"
        >
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#7C5CFF]">
            A solução
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-[#ECEAFF] md:text-4xl">
            Da gestão reativa para uma{' '}
            <em className="font-serif font-light italic text-[#C0AFFF]">operação previsível</em>
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-[#8B85A0]">
            Você mantém o atendimento consultivo e ganha estrutura para executar com método,
            visibilidade e controle.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {comparison.map(({ tag, subtitle, points, cardBg, cardBorder, tagColor, iconColor, Icon, x, delay }) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, x }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ background: cardBg, borderColor: cardBorder }}
              className="border p-6 transition-shadow duration-300 md:p-8"
            >
              <div className="mb-6 flex items-start gap-3">
                <Icon size={18} style={{ color: iconColor }} className="mt-0.5 shrink-0" />
                <div>
                  <span className="block text-sm font-semibold" style={{ color: tagColor }}>
                    {tag}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#524C66]">
                    {subtitle}
                  </span>
                </div>
              </div>
              <ul className="space-y-4">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-[#8B85A0]">
                    <Icon
                      size={14}
                      style={{ color: iconColor }}
                      className="mt-0.5 shrink-0"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Attributes strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-16 grid grid-cols-1 gap-0 border border-[rgba(236,234,255,0.08)] md:grid-cols-3"
        >
          {[
            { num: '01', title: 'Preciso', desc: 'Decisões em segundos, não relatórios. Cada interação devolve dado acionável.' },
            { num: '02', title: 'Leve', desc: 'Pensado para times que entregam por hora. Sem fricção operacional.' },
            { num: '03', title: 'Mensurável', desc: 'Projeto, hora e P&L num lugar só. Margem visível a qualquer momento.' },
          ].map(({ num, title, desc }, i) => (
            <div
              key={num}
              className={`border-[rgba(236,234,255,0.08)] p-8 ${i < 2 ? 'border-b md:border-b-0 md:border-r' : ''}`}
            >
              <p className="mb-3 font-mono text-[11px] tracking-[0.1em] text-[#7C5CFF]">[ {num} ]</p>
              <h4 className="mb-2 text-lg font-semibold tracking-[-0.02em] text-[#ECEAFF]">{title}</h4>
              <p className="text-sm leading-relaxed text-[#8B85A0] font-light">{desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
