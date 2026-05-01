import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MessageSquare, Settings, DollarSign, BarChart3, ArrowRight, ChevronDown } from 'lucide-react';

const flowSteps = [
  { number: '01', label: 'Atendimento estruturado', Icon: MessageSquare },
  { number: '02', label: 'Execução padronizada', Icon: Settings },
  { number: '03', label: 'Financeiro integrado', Icon: DollarSign },
  { number: '04', label: 'Decisão com dados', Icon: BarChart3 },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const stepsContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const stepItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] items-center overflow-hidden px-6 pb-16 pt-14 md:pb-20 md:pt-16">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-64 -top-64 h-[700px] w-[700px] rounded-full bg-blue-100/50 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full bg-indigo-100/40 blur-3xl"
          animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(30,58,95,0.07),transparent)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div
          className="flex flex-col items-center gap-8 text-center"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Sistema para Consultorias
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={item}
            className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl lg:text-[68px]"
          >
            Pare de gerenciar sua consultoria{' '}
            <span className="bg-gradient-to-r from-[#1e3a5f] via-blue-700 to-blue-500 bg-clip-text text-transparent">
              em planilhas soltas.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            className="max-w-2xl text-lg leading-relaxed text-slate-500 md:text-xl"
          >
            O Gestão Ágil centraliza atendimento, execução, documentos e financeiro em um fluxo único para
            você ganhar{' '}
            <strong className="font-semibold text-slate-700">
              previsibilidade operacional e margem.
            </strong>
          </motion.p>

          {/* CTAs */}
          <motion.div variants={item} className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="group bg-[#1e3a5f] text-white shadow-lg shadow-[#1e3a5f]/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#152d4a] hover:shadow-xl hover:shadow-[#1e3a5f]/30"
            >
              <a href="#contato" className="flex items-center gap-2">
                Quero falar com o time comercial
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50"
            >
              <a href="/login">Acessar o sistema</a>
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.p variants={item} className="text-sm text-slate-400">
            Implantação guiada · Perfis por tipo de usuário · Operação pronta para crescer
          </motion.p>

          {/* Flow steps card */}
          <motion.div
            variants={item}
            className="w-full max-w-5xl rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-sm md:p-8"
          >
            <motion.div className="grid gap-4 md:grid-cols-4" variants={stepsContainer}>
              {flowSteps.map(({ number, label, Icon }) => (
                <motion.div
                  key={number}
                  variants={stepItem}
                  className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{number}</p>
                    <div className="rounded-lg bg-[#1e3a5f]/10 p-1.5 text-[#1e3a5f] transition-colors duration-200 group-hover:bg-blue-100 group-hover:text-blue-600">
                      <Icon size={15} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div variants={item}>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown size={22} className="text-slate-300" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
