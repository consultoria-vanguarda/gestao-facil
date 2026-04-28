import SectionContainer from './SectionContainer';
import { Button } from '@/components/ui/button';

export default function ContactSection() {
  return (
    <SectionContainer id="contato" className="bg-slate-900">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-slate-800 p-8 text-center md:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">Contato comercial</p>
        <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Quer ver o Gestão Ágil aplicado à sua consultoria?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Fale com nosso time para avaliar seu cenário, mapear ganhos rápidos e entender o melhor formato de implantação.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-200">
            <a href="mailto:comercial@gestaoagil.com.br">Falar com comercial</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-slate-500 text-slate-100 hover:bg-slate-700">
            <a href="/login">Entrar na plataforma</a>
          </Button>
        </div>

        <p className="mt-5 text-xs text-slate-400">
          Resposta em horário comercial · Atendimento consultivo · Sem compromisso
        </p>
      </div>
    </SectionContainer>
  );
}
