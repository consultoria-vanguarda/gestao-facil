import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Mail, ArrowRight } from 'lucide-react';

export default function ContactSection() {
  return (
    <section id="contato" className="relative overflow-hidden bg-[#0c1a2e] px-6 py-16 md:py-20">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl"
          animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(30,58,95,0.3),transparent)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 28 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-md md:p-12"
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-blue-400"
          >
            Contato comercial
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-3 text-3xl font-bold text-white md:text-4xl"
          >
            Quer ver o Gestão Ágil aplicado à sua consultoria?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300/80"
          >
            Fale com nosso time para avaliar seu cenário, mapear ganhos rápidos e entender o melhor formato
            de implantação.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button
              asChild
              size="lg"
              className="bg-white font-semibold text-slate-900 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-xl"
            >
              <a href="mailto:comercial@gestaoagil.com.br" className="flex items-center gap-2">
                <Mail size={16} />
                Falar com comercial
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="group border-white/20 text-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10"
            >
              <a href="/login" className="flex items-center gap-2">
                Entrar na plataforma
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </a>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.65, duration: 0.5 }}
            className="mt-5 text-xs text-slate-500"
          >
            Resposta em horário comercial · Atendimento consultivo · Sem compromisso
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
