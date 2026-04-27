import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl, createHourlyRatesViabilityUrl } from '../utils';
import { motion } from 'framer-motion';
import { ArrowRight, Calculator, ChevronDown } from 'lucide-react';
import { publicStorageObjectUrl } from '@/lib/supabasePublicStorage';

const LOGO_URL = publicStorageObjectUrl(
  'public/695ebd99a400611ea331a00a/dd42951c1_Logomarca.JPG'
);

const menuLinks = [
  { label: 'Atendimentos', page: 'Projects' },
  { label: 'Clientes', page: 'Clients' },
  { label: 'Financeiro', page: 'Financial' },
  { label: 'Relatórios', page: 'Reports' },
];

export default function Dashboard() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1e] overflow-x-hidden">

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#5b3fa0]/20 blur-[120px] animate-pulse" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#38bcd4]/20 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#7b5ea7]/10 blur-[140px]" />
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />

        {/* Decorative rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-[#7b5ea7]/20" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-6 text-center">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            <div className="relative inline-block">
              {/* Glow behind logo */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7b5ea7]/40 to-[#38bcd4]/30 blur-2xl scale-110" />
              <div className="relative bg-white rounded-2xl px-10 py-6 shadow-2xl shadow-[#7b5ea7]/30">
                <img
                  src={LOGO_URL}
                  alt="Vanguarda Consultoria"
                  className="h-20 md:h-28 w-auto object-contain"
                />
              </div>
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mb-3"
          >
            <span className="inline-block px-4 py-1.5 rounded-full border border-[#7b5ea7]/40 bg-[#7b5ea7]/10 text-[#c0a8f0] text-xs font-semibold tracking-widest uppercase">
              Sistema de Gestão
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4"
          >
            Gestão Inteligente<br />
            <span className="bg-gradient-to-r from-[#7b5ea7] via-[#a78bda] to-[#38bcd4] bg-clip-text text-transparent">
              para sua Consultoria
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="text-white/50 text-base md:text-lg max-w-xl mb-12"
          >
            Projetos, clientes, financeiro e relatórios — tudo em um só lugar,
            com a eficiência que a Vanguarda representa.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            className="flex flex-wrap gap-4 justify-center mb-16"
          >
            <Link
              to={createPageUrl('Projects')}
              className="group flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#7b5ea7] to-[#38bcd4] text-white font-bold text-sm hover:shadow-lg hover:shadow-[#7b5ea7]/40 transition-all hover:scale-105"
            >
              Acessar Atendimentos
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to={createHourlyRatesViabilityUrl()}
              className="group flex items-center gap-2 px-8 py-3.5 rounded-full border border-[#38bcd4]/40 bg-[#38bcd4]/10 text-white font-semibold text-sm hover:bg-[#38bcd4]/20 hover:border-[#38bcd4]/60 transition-all backdrop-blur-sm"
            >
              <Calculator className="w-4 h-4 shrink-0 text-[#7ee8ff]" />
              Análise de Viabilidade
            </Link>
            <Link
              to={createPageUrl('Financial')}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full border border-white/20 bg-white/5 text-white font-semibold text-sm hover:bg-white/10 hover:border-white/40 transition-all backdrop-blur-sm"
            >
              Financeiro
            </Link>
          </motion.div>

          {/* Quick nav cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl"
          >
            {menuLinks.map((item, i) => (
              <motion.div
                key={item.page}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + i * 0.08 }}
              >
                <Link
                  to={createPageUrl(item.page)}
                  className="block p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#7b5ea7]/50 text-white/70 hover:text-white text-sm font-medium text-center transition-all backdrop-blur-sm hover:shadow-md hover:shadow-[#7b5ea7]/10"
                >
                  {item.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30"
        >
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </motion.div>
      </section>

      {/* Features strip */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Uma plataforma completa
            </h2>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              Todos os módulos integrados para a gestão eficiente da sua consultoria
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '📋',
                title: 'Gestão de Projetos',
                desc: 'Cronogramas, fases, acompanhamento em tempo real e kanban visual.',
                page: 'Projects',
                gradient: 'from-[#7b5ea7]/20 to-[#7b5ea7]/5',
                border: 'border-[#7b5ea7]/30',
              },
              {
                icon: '💰',
                title: 'Controle Financeiro',
                desc: 'Faturamento, recebimentos, DRE e dashboards financeiros integrados.',
                page: 'Financial',
                gradient: 'from-[#38bcd4]/20 to-[#38bcd4]/5',
                border: 'border-[#38bcd4]/30',
              },
              {
                icon: '📊',
                title: 'Relatórios',
                desc: 'Relatórios de desempenho, propostas e documentação profissional.',
                page: 'Reports',
                gradient: 'from-[#a78bda]/20 to-[#a78bda]/5',
                border: 'border-[#a78bda]/30',
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                <Link to={createPageUrl(f.page)} className="group block h-full">
                  <div className={`h-full p-6 rounded-2xl bg-gradient-to-br ${f.gradient} border ${f.border} hover:scale-[1.02] transition-all duration-300`}>
                    <div className="text-3xl mb-4">{f.icon}</div>
                    <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-[#a78bda] text-xs font-semibold group-hover:gap-2 transition-all">
                      Acessar <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer strip */}
      <div className="border-t border-white/5 py-6 text-center">
        <img src={LOGO_URL} alt="Vanguarda" className="h-8 w-auto mx-auto opacity-30 object-contain" />
      </div>
    </div>
  );
}