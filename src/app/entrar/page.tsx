"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";

export default function EntrarPage() {
  const router = useRouter();
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedCode = groupCode.trim().toLowerCase();

    if (!normalizedCode) {
      setError("Informe o código do grupo.");
      return;
    }

    if (normalizedCode.length !== 6) {
      setError("O código do grupo deve ter 6 caracteres.");
      return;
    }

    router.push(`/${normalizedCode}`);
  }

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,149,0,0.12),transparent_40%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />

      <section className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl flex-col px-6 pb-16 pt-8 md:px-10">
        <BlurFade inView>
          <div className="mb-10">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/">
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Link>
            </Button>
          </div>
        </BlurFade>

        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="flex flex-col justify-center">
              <BlurFade inView delay={0.05}>
                <Badge
                  variant="secondary"
                  className="mb-6 w-fit rounded-full border border-secondary/30 bg-secondary text-secondary-foreground px-4 py-1.5 text-xs font-medium"
                >
                  Acessar grupo
                </Badge>
              </BlurFade>

              <BlurFade inView delay={0.1}>
                <h1 className="font-heading max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Entre em um grupo com o código compartilhado.
                </h1>
              </BlurFade>

              <BlurFade inView delay={0.16}>
                <div className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                  <TextAnimate animation="blurInUp" by="word" once>
                    Digite o código do grupo para seguir para a tela de acesso,
                    escolher seu jogador e informar a senha do grupo.
                  </TextAnimate>
                </div>
              </BlurFade>

              <BlurFade inView delay={0.22}>
                <div className="mt-8 rounded-2xl border border-border/70 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                  O código tem 6 caracteres e é gerado automaticamente na criação
                  do grupo.
                </div>
              </BlurFade>
            </div>

            <BlurFade inView delay={0.12}>
              <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6 shadow-xl shadow-black/10 backdrop-blur md:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="groupCode"
                      className="mb-2 block text-sm font-medium"
                    >
                      Código do grupo
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="groupCode"
                        type="text"
                        value={groupCode}
                        onChange={(e) =>
                          setGroupCode(
                            e.target.value.replace(/\s/g, "").toLowerCase()
                          )
                        }
                        placeholder="Ex.: ab12cd"
                        maxLength={6}
                        className="h-14 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="h-14 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20"
                  >
                    Continuar
                    <ArrowRight className="ml-2 size-4" />
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Ainda não tem grupo?{" "}
                    <Link
                      href="/criar-grupo"
                      className="font-medium text-secondary hover:underline"
                    >
                      Criar agora
                    </Link>
                  </p>
                </form>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>
    </main>
  );
}