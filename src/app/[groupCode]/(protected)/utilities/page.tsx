"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UtilitiesPage() {
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Utilities
        </h1>
      </div>

      <section>
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Ferramentas disponiveis
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-3xl border border-border/70 bg-background/30 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary text-secondary-foreground">
                      <Timer className="size-5" />
                    </div>

                    <div>
                      <h2 className="font-heading text-xl font-semibold">
                        Cronometro de Big Blinds
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Configure niveis, duracao por fase e acompanhe a troca de
                        blinds em tempo real.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                      Setup de niveis
                    </span>
                    <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                      Timer da mesa
                    </span>
                    <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                      Presets do grupo
                    </span>
                  </div>
                </div>

                <Button asChild className="rounded-full">
                  <Link href={`/${groupCode}/utilities/blinds`}>
                    Abrir utilitario
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
