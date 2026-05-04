import { motion } from 'framer-motion';
import { Mail, ArrowRight } from 'lucide-react';

export default function ContactSection() {
  return (
    <section id="contato" className="relative overflow-hidden border-t border-[rgba(236,234,255,0.08)] bg-[#0A0612] px-6 py-20 md:px-12 md:py-28">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[60vh] w-[60vw] -translate-x-1/2 -translate-y-1/2 opacity-20 blur-[80px]"
          style={{ background: 'radial-gradient(ellipse at center, #4A2EE0 0%, transparent 60%)' }}
        />
        <motion.div
          className="absolute right-[-10%] top-[-20%] h-[50vh] w-[40vw] opacity-10 blur-[60px]"
          style={{ background: 'radial-gradient(ellipse at center, #7C5CFF 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 28 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mx-auto max-w-3xl border border-[rgba(236,234,255,0.08)] bg-[#14101F] p-8 text-center md:p-14"
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#7C5CFF]"
          >
            Contato comercial
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-4 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-[#ECEAFF] md:text-4xl"
          >
            Quer ver o GestãoUP aplicado{' '}
            <em className="font-serif font-light italic text-[#C0AFFF]">à sua consultoria?</em>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#8B85A0]"
          >
            Fale com nosso time para avaliar seu cenário, mapear ganhos rápidos e entender o
            melhor formato de implantação.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="mailto:comercial@gestaoup.com.br"
              className="inline-flex items-center gap-2 bg-[#ECEAFF] px-6 py-3 text-sm font-semibold text-[#0A0612] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"
            >
              <Mail size={15} />
              Falar com comercial
            </a>
            <a
              href="/login"
              className="group inline-flex items-center gap-2 border border-[rgba(236,234,255,0.16)] px-6 py-3 text-sm font-medium text-[#B5B0C9] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(236,234,255,0.3)] hover:text-[#ECEAFF]"
            >
              Entrar na plataforma
              <ArrowRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.65, duration: 0.5 }}
            className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-[#524C66]"
          >
            Resposta em horário comercial · Atendimento consultivo · Sem compromisso
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
