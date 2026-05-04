import { motion } from 'framer-motion';
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
    <section className="relative flex min-h-[92vh] items-center overflow-hidden px-6 pb-20 pt-16 md:px-12 md:pb-24 md:pt-20">
      {/* Ambient violet glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[-20vh] h-[55vh] w-[75vw] -translate-x-1/2 opacity-30 blur-[80px]"
          style={{ background: 'radial-gradient(ellipse at center, #4A2EE0 0%, transparent 60%)' }}
        />
        <motion.div
          className="absolute right-[-20%] top-[10%] h-[40vh] w-[40vw] opacity-10 blur-[60px]"
          style={{ background: 'radial-gradient(ellipse at center, #7C5CFF 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.18, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div
          className="flex flex-col items-center gap-10 text-center"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 border border-[rgba(124,92,255,0.3)] bg-[rgba(124,92,255,0.08)] px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#9F84FF]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C5CFF] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
              </span>
              Operating system for consultancies
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={item}
            className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#ECEAFF] md:text-6xl lg:text-[68px]"
          >
            O sistema que tira sua empresa{' '}
            <em className="font-serif font-light italic text-[#C0AFFF]">do Excel.</em>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            className="max-w-2xl text-lg leading-relaxed text-[#8B85A0] md:text-xl"
          >
            Projetos, horas, finanças e entregáveis — operados num lugar só. Construído com a{' '}
            <span className="font-medium text-[#B5B0C9]">
              opinião do mercado de consultoria embutida.
            </span>
          </motion.p>

          {/* CTAs */}
          <motion.div variants={item} className="flex flex-wrap justify-center gap-3">
            <a
              href="#contato"
              className="group inline-flex items-center gap-2 bg-[#7C5CFF] px-6 py-3 text-sm font-medium text-[#0A0612] shadow-lg shadow-[#7C5CFF]/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#9F84FF] hover:shadow-xl hover:shadow-[#7C5CFF]/30"
            >
              Falar com o time comercial
              <ArrowRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </a>
            <a
              href="/login"
              className="inline-flex items-center gap-2 border border-[rgba(236,234,255,0.16)] px-6 py-3 text-sm font-medium text-[#B5B0C9] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(236,234,255,0.3)] hover:text-[#ECEAFF]"
            >
              Acessar o sistema
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#524C66]">
            Implantação guiada · Perfis por tipo de usuário · Operação pronta para crescer
          </motion.p>

          {/* Flow steps card */}
          <motion.div
            variants={item}
            className="w-full max-w-5xl border border-[rgba(236,234,255,0.08)] bg-[#14101F] p-6 md:p-8"
          >
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7C5CFF]">
              Fluxo operacional
            </p>
            <motion.div className="grid gap-4 md:grid-cols-4" variants={stepsContainer}>
              {flowSteps.map(({ number, label, Icon }) => (
                <motion.div
                  key={number}
                  variants={stepItem}
                  className="group border border-[rgba(236,234,255,0.06)] bg-[#1A1626] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(124,92,255,0.25)] hover:bg-[#2A2538]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-[11px] font-medium tracking-[0.1em] text-[#7C5CFF]">
                      {number}
                    </p>
                    <div className="text-[#524C66] transition-colors duration-200 group-hover:text-[#7C5CFF]">
                      <Icon size={15} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#ECEAFF]">{label}</p>
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
              <ChevronDown size={20} className="text-[#524C66]" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
