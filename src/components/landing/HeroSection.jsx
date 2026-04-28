import { Button } from '@/components/ui/button';

const flowSteps = [
  'Atendimento estruturado',
  'Execução padronizada',
  'Financeiro integrado',
  'Decisão com dados',
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-14 md:pb-24 md:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1e3a5f_0%,transparent_60%)] opacity-15" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 text-center">
        <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
          Sistema para Consultorias
        </div>

        <div className="max-w-4xl space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-6xl">
            Pare de gerenciar sua consultoria em planilhas soltas.
          </h1>
          <p className="text-lg leading-relaxed text-slate-600 md:text-xl">
            O Gestão Ágil centraliza atendimento, execução, documentos e financeiro em um fluxo único para você
            ganhar previsibilidade operacional e margem.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <a href="#contato">Quero falar com o time comercial</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="/login">Acessar o sistema</a>
          </Button>
        </div>

        <p className="text-sm text-slate-500">
          Implantação guiada · Perfis por tipo de usuário · Operação pronta para crescer
        </p>

        <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-4 md:grid-cols-4">
            {flowSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">0{index + 1}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
