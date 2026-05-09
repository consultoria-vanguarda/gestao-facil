import React, { useMemo, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ReactMarkdown from 'react-markdown';
import { Bot, Loader2, MessageSquare, SendHorizontal, Square } from 'lucide-react';

import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

function textFromParts(message) {
  const parts = message?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function AiAssistant() {
  const { toast } = useToast();
  const scrollRef = useRef(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const transport = useMemo(() => {
    const api = `${supabaseUrl?.replace(/\/$/, '')}/functions/v1/ai-chat`;
    return new DefaultChatTransport({
      api,
      headers: async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error('Faça login para usar o assistente.');
        }
        return {
          Authorization: `Bearer ${token}`,
          apikey: anonKey ?? '',
        };
      },
    });
  }, [supabaseUrl, anonKey]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: 'gestao-agil-assistant',
    transport,
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Assistente',
        description: err?.message ?? 'Não foi possível obter resposta.',
      });
    },
  });

  const busy = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput('');
    await sendMessage({ text: trimmed });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a5f] text-white shadow-md transition hover:bg-[#152a45] lg:bottom-8 lg:right-8"
          aria-label="Abrir assistente de IA"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-200 px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5" />
            Assistente
          </SheetTitle>
          <SheetDescription className="text-left text-xs">
            Perguntas sobre o sistema e rascunhos de propostas. Powered by IA (configurável no servidor).
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-4 pr-2">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Envie uma mensagem para começar. Ex.: “Como cadastro um novo projeto?” ou “Monte um
                roteiro de proposta para diagnóstico em TI.”
              </p>
            )}
            {messages.map((m) => {
              const text = textFromParts(m);
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                      isUser ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{text}</span>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:text-slate-900">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando…
              </div>
            )}
            {error && (
              <p className="text-xs text-red-600">{error.message}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva sua pergunta…"
              rows={2}
              className="min-h-[72px] resize-none"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex flex-col gap-1">
              {busy ? (
                <Button type="button" variant="secondary" size="icon" onClick={() => stop()} title="Parar">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} title="Enviar">
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
