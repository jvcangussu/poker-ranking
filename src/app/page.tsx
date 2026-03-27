import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,149,0,0.12),transparent_40%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />

      <section className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl flex-col px-6 pb-16 pt-6 md:px-10">
        <BlurFade inView className="mb-12">
          <header className="flex items-center justify-between rounded-full border border-border/70 bg-card/60 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full border border-primary bg-card shadow-sm overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Logo Poker Ranking"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>

              <div>
                <p className="font-heading text-sm font-semibold tracking-tight">
                  Poker Ranking
                </p>
                <p className="text-xs text-muted-foreground">
                  Controle simples para o seu grupo
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/entrar">Acessar grupo</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link href="/criar-grupo">Criar grupo</Link>
              </Button>
            </nav>
          </header>
        </BlurFade>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-4xl flex-col items-center text-center">
            <BlurFade inView delay={0.05}>
              <Badge
                variant="secondary"
                className="mb-6 rounded-full border border-secondary/30 bg-secondary text-secondary-foreground px-4 py-1.5 text-xs font-medium"
              >
                Ranking, histórico e saldo em um só lugar
              </Badge>
            </BlurFade>

            <BlurFade inView delay={0.1}>
              <h1 className="font-heading max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Organize o seu grupo de poker com uma experiência bonita e sem
                complicação.
              </h1>
            </BlurFade>

            <BlurFade inView delay={0.16}>
              <div className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                <TextAnimate animation="blurInUp" by="word" once>
                  Crie um grupo, acompanhe lucro e prejuízo de cada jogador e
                  mantenha um ranking sempre atualizado, sem depender de
                  planilhas.
                </TextAnimate>
              </div>
            </BlurFade>

            <BlurFade inView delay={0.22}>
              <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-14 min-w-[240px] rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20"
                >
                  <Link href="/criar-grupo">
                    Criar meu grupo
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 min-w-[240px] rounded-full px-8 text-base font-semibold"
                >
                  <Link href="/entrar">Já tenho um código</Link>
                </Button>
              </div>
            </BlurFade>

            <BlurFade inView delay={0.28}>
              <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-card/50 px-4 py-2">
                  Grupos privados
                </span>
                <span className="rounded-full border border-border/70 bg-card/50 px-4 py-2">
                  Atualização simples de saldo
                </span>
                <span className="rounded-full border border-border/70 bg-card/50 px-4 py-2">
                  Histórico persistido
                </span>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>
    </main>
  );
}