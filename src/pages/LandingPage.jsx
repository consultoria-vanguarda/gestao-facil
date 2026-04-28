import HeroSection from '@/components/landing/HeroSection';
import ProblemSolutionSection from '@/components/landing/ProblemSolutionSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import ModulesSection from '@/components/landing/ModulesSection';
import BenefitsSection from '@/components/landing/BenefitsSection';
import SocialProofSection from '@/components/landing/SocialProofSection';
import FaqSection from '@/components/landing/FaqSection';
import ContactSection from '@/components/landing/ContactSection';

const navLinks = [
  { label: 'Sobre', href: '#sobre' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contato', href: '#contato' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-bold text-[#1e3a5f]">Gestão Ágil</a>
          <nav className="hidden items-center gap-5 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <a href="/login" className="text-sm font-semibold text-[#1e3a5f] hover:underline">Entrar</a>
        </div>
      </header>

      <main>
        <HeroSection />
        <ProblemSolutionSection />
        <HowItWorksSection />
        <ModulesSection />
        <BenefitsSection />
        <SocialProofSection />
        <FaqSection />
        <ContactSection />
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 text-sm text-slate-500 md:flex-row">
          <p>Gestão Ágil · Sistema para Consultorias</p>
          <a href="/login" className="font-semibold text-[#1e3a5f] hover:underline">Área interna</a>
        </div>
      </footer>
    </div>
  );
}
