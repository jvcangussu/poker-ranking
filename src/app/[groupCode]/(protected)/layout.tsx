"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Swords,
  Settings,
  Shield,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PokerSession } from "@/types/session";

export default function GroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("poker-session");

    if (!stored) {
      router.replace(`/${groupCode}`);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PokerSession;

      if (!parsed?.groupCode || parsed.groupCode !== groupCode) {
        localStorage.removeItem("poker-session");
        router.replace(`/${groupCode}`);
        return;
      }

      setSession(parsed);
    } catch {
      localStorage.removeItem("poker-session");
      router.replace(`/${groupCode}`);
      return;
    } finally {
      setCheckingSession(false);
    }
  }, [groupCode, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem("poker-session");
    router.replace(`/${groupCode}`);
  }

  const navItems = [
    {
      href: `/${groupCode}/ranking`,
      label: "Ranking",
      icon: Trophy,
    },
    {
      href: `/${groupCode}/jogadores`,
      label: "Jogadores",
      icon: Users,
    },
    {
      href: `/${groupCode}/partidas`,
      label: "Partidas",
      icon: Swords,
    },
    {
      href: `/${groupCode}/configuracoes`,
      label: "Configurações",
      icon: Settings,
    },
  ];

  const adminHref = `/${groupCode}/admin`;

  if (checkingSession) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando sessão...
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="relative min-h-[calc(100vh-72px)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,149,0,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />

      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-6 md:px-10">
        <header className="rounded-[2rem] border border-border/70 bg-card/60 p-4 shadow-xl shadow-black/10 backdrop-blur md:p-5">
          <div className="flex flex-col gap-3 md:gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex w-full min-w-0 items-start justify-between gap-3 lg:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary bg-card p-1 shadow-sm">
                  <Image
                    src="/logo.png"
                    alt="Logo Poker Ranking"
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                    priority
                  />
                </div>

                <div className="min-w-0">
                  <p className="font-heading truncate text-xl font-semibold tracking-tight">
                    {session.groupName}
                  </p>
                  <div className="mt-1 hidden flex-wrap items-center gap-2 text-sm text-muted-foreground md:flex">
                    <span className="rounded-full border border-border/70 bg-background/40 px-3 py-1">
                      Código:{" "}
                      <span className="font-medium text-foreground">
                        {session.groupCode}
                      </span>
                    </span>

                    <span className="rounded-full border border-border/70 bg-background/40 px-3 py-1">
                      Jogador:{" "}
                      <span className="font-medium text-foreground">
                        {session.playerName}
                      </span>
                    </span>

                    {session.isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary px-3 py-1 text-secondary-foreground">
                        <Shield className="size-3.5" />
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 size-4" />
                Sair
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 md:hidden">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <span className="rounded-full border border-border/70 bg-background/40 px-2.5 py-1 sm:px-3">
                  Código:{" "}
                  <span className="font-medium text-foreground">
                    {session.groupCode}
                  </span>
                </span>

                <span className="rounded-full border border-border/70 bg-background/40 px-2.5 py-1 sm:px-3">
                  Jogador:{" "}
                  <span className="font-medium text-foreground">
                    {session.playerName}
                  </span>
                </span>

                {session.isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary px-2.5 py-1 text-secondary-foreground sm:px-3">
                    <Shield className="size-3.5" />
                    Admin
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-expanded={mobileNavOpen}
                aria-controls="group-mobile-nav"
                aria-label={
                  mobileNavOpen
                    ? "Fechar menu de navegação"
                    : "Abrir menu de navegação"
                }
              >
                {mobileNavOpen ? (
                  <X className="size-5" aria-hidden />
                ) : (
                  <Menu className="size-5" aria-hidden />
                )}
              </Button>
            </div>
          </div>

          <nav
            className="mt-5 hidden flex-wrap gap-2 md:flex"
            aria-label="Navegação principal"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "border-border/70 bg-background/40 text-muted-foreground hover:border-secondary/40 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}

            {session.isAdmin && (
              <Link
                href={adminHref}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  pathname === adminHref
                    ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "border-border/70 bg-background/40 text-muted-foreground hover:border-secondary/40 hover:text-foreground"
                )}
              >
                <Shield className="size-4" />
                Admin
              </Link>
            )}
          </nav>

          {mobileNavOpen ? (
            <nav
              id="group-mobile-nav"
              className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-4 md:hidden"
              aria-label="Navegação principal"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={`m-${item.href}`}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:border-secondary/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}

              {session.isAdmin && (
                <Link
                  href={adminHref}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-medium transition",
                    pathname === adminHref
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "border-border/70 bg-background/40 text-muted-foreground hover:border-secondary/40 hover:text-foreground"
                  )}
                >
                  <Shield className="size-4 shrink-0" />
                  Admin
                </Link>
              )}
            </nav>
          ) : null}
        </header>

        <section className="pt-6">{children}</section>
      </div>
    </main>
  );
}