"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";

export default function CriarGrupoPage() {
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedGroupName = groupName.trim();
    const trimmedGroupPassword = groupPassword.trim();
    const trimmedAdminPassword = adminPassword.trim();
    const trimmedPlayerName = playerName.trim();

    if (
      !trimmedGroupName ||
      !trimmedGroupPassword ||
      !trimmedAdminPassword ||
      !trimmedPlayerName
    ) {
      setError("Preencha todos os campos.");
      return;
    }

    if (trimmedGroupPassword.length < 4) {
      setError("A senha do grupo deve ter pelo menos 4 caracteres.");
      return;
    }

    if (trimmedAdminPassword.length < 4) {
      setError("A senha de administrador deve ter pelo menos 4 caracteres.");
      return;
    }

    if (trimmedAdminPassword !== confirmAdminPassword.trim()) {
      setError("A confirmação da senha de administrador não confere.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc("create_group_with_admin", {
        p_group_name: trimmedGroupName,
        p_group_password: trimmedGroupPassword,
        p_admin_password: trimmedAdminPassword,
        p_admin_player_name: trimmedPlayerName,
      });

      if (error) {
        throw error;
      }

      const createdGroup = data?.[0];

      if (!createdGroup?.group_code) {
        throw new Error("Não foi possível criar o grupo.");
      }

      localStorage.setItem(
        "poker-session",
        JSON.stringify({
          groupId: createdGroup.group_id,
          groupCode: createdGroup.group_code,
          groupName: createdGroup.group_name,
          playerId: createdGroup.admin_player_id,
          playerName: createdGroup.admin_player_name,
          isAdmin: true,
        })
      );

      router.push(`/${createdGroup.group_code}/ranking`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar o grupo.";
      setError(message);
    } finally {
      setLoading(false);
    }
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
                  Novo grupo
                </Badge>
              </BlurFade>

              <BlurFade inView delay={0.1}>
                <h1 className="font-heading max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Crie seu grupo e comece a organizar cada partida.
                </h1>
              </BlurFade>

              <BlurFade inView delay={0.16}>
                <div className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                  <TextAnimate animation="blurInUp" by="word" once>
                    Defina a senha do grupo (para todos), a senha de
                    administrador (só para admins) e crie seu jogador inicial já
                    como administrador.
                  </TextAnimate>
                </div>
              </BlurFade>

              <BlurFade inView delay={0.22}>
                <div className="mt-8 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 px-4 py-3">
                    <Sparkles className="size-4 text-secondary" />
                    Um código curto será gerado automaticamente para o grupo.
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 px-4 py-3">
                    <Sparkles className="size-4 text-secondary" />
                    O primeiro jogador criado já entra como administrador.
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 px-4 py-3">
                    <Sparkles className="size-4 text-secondary" />
                    Quem for admin no login usa a senha do grupo e a senha de
                    administrador.
                  </div>
                </div>
              </BlurFade>
            </div>

            <BlurFade inView delay={0.12}>
              <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6 shadow-xl shadow-black/10 backdrop-blur md:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="groupName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Nome do grupo
                    </label>
                    <input
                      id="groupName"
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Ex.: Poker de Sexta"
                      className="h-13 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="groupPassword"
                      className="mb-2 block text-sm font-medium"
                    >
                      Senha do grupo
                    </label>
                    <input
                      id="groupPassword"
                      type="password"
                      value={groupPassword}
                      onChange={(e) => setGroupPassword(e.target.value)}
                      placeholder="Mínimo de 4 caracteres"
                      autoComplete="new-password"
                      className="h-13 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="adminPassword"
                      className="mb-2 block text-sm font-medium"
                    >
                      Senha de administrador
                    </label>
                    <input
                      id="adminPassword"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Para quem for admin no grupo (mín. 4 caracteres)"
                      autoComplete="new-password"
                      className="h-13 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirmAdminPassword"
                      className="mb-2 block text-sm font-medium"
                    >
                      Confirmar senha de administrador
                    </label>
                    <input
                      id="confirmAdminPassword"
                      type="password"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      placeholder="Repita a senha de administrador"
                      autoComplete="new-password"
                      className="h-13 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="playerName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Seu nome de jogador
                    </label>
                    <input
                      id="playerName"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Ex.: João"
                      className="h-13 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="h-14 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Criando grupo...
                      </>
                    ) : (
                      <>
                        Criar meu grupo
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Já tem um grupo?{" "}
                    <Link
                      href="/entrar"
                      className="font-medium text-secondary hover:underline"
                    >
                      Acessar agora
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