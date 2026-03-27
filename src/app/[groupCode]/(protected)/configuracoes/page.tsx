"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  LogOut,
  Save,
  Settings,
  Shield,
  User,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { PokerSession } from "@/types/session";
import type { Group, Player } from "@/types/database";

type GroupPublicByIdRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string | null;
};

type UpdateGroupNameRow = {
  id: string;
  name: string;
};

type UpdatePlayerProfileRow = {
  id: string;
  name: string;
  photo_url: string | null;
  pix_key: string | null;
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [savingGroupName, setSavingGroupName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("poker-session");

    if (!stored) {
      setLoading(false);
      setPageError("Sessão não encontrada.");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PokerSession;

      if (!parsed?.groupCode || parsed.groupCode !== groupCode) {
        setLoading(false);
        setPageError("Sessão inválida para este grupo.");
        return;
      }

      setSession(parsed);
    } catch {
      setLoading(false);
      setPageError("Não foi possível carregar a sessão.");
    }
  }, [groupCode]);

  useEffect(() => {
    async function loadData() {
      if (!session) return;

      try {
        setLoading(true);
        setPageError(null);

        const [
          { data: groupRpcData, error: groupError },
          { data: playerData, error: playerError },
        ] = await Promise.all([
          supabase.rpc("get_group_public_by_id", {
            p_group_id: session.groupId,
          }),
          supabase
            .from("players")
            .select(
              "id, group_id, name, is_admin, photo_url, pix_key, created_at, updated_at"
            )
            .eq("id", session.playerId)
            .maybeSingle(),
        ]);

        if (groupError) throw groupError;
        if (playerError) throw playerError;

        const groupData = (groupRpcData?.[0] as GroupPublicByIdRow | undefined) ?? null;

        if (!groupData) throw new Error("Grupo não encontrado.");
        if (!playerData) throw new Error("Jogador não encontrado.");

        setGroup(groupData as Group);
        setPlayer(playerData as Player);

        setGroupName(groupData.name);
        setPlayerName(playerData.name);
        setPhotoUrl(playerData.photo_url ?? "");
        setPixKey(playerData.pix_key ?? "");
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Erro ao carregar configurações."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  async function handleSaveGroupName() {
    if (!session?.isAdmin || !group) return;

    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setFeedback("Informe um nome válido para o grupo.");
      return;
    }

    try {
      setSavingGroupName(true);
      setFeedback(null);

      const { data, error } = await supabase.rpc("update_group_name", {
        p_group_id: group.id,
        p_name: trimmedName,
      });

      if (error) throw error;

      const updated = (data?.[0] as UpdateGroupNameRow | undefined) ?? null;

      if (updated) {
        setGroup((prev) => (prev ? { ...prev, name: updated.name } : prev));

        const stored = localStorage.getItem("poker-session");
        if (stored) {
          const parsed = JSON.parse(stored) as PokerSession;
          parsed.groupName = updated.name;
          localStorage.setItem("poker-session", JSON.stringify(parsed));
          setSession(parsed);
        }
      }

      setFeedback("Nome do grupo atualizado com sucesso.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao salvar nome do grupo."
      );
    } finally {
      setSavingGroupName(false);
    }
  }

  async function handleSavePassword() {
    if (!session?.isAdmin || !group) return;

    if (newPassword.trim().length < 4) {
      setFeedback("A nova senha deve ter pelo menos 4 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("A confirmação da senha não confere.");
      return;
    }

    try {
      setSavingPassword(true);
      setFeedback(null);

      const { error } = await supabase.rpc("update_group_password", {
        p_group_id: group.id,
        p_new_password: newPassword.trim(),
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setFeedback("Senha do grupo atualizada com sucesso.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao atualizar a senha."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveProfile() {
    if (!player) return;

    const trimmedName = playerName.trim();

    if (!trimmedName) {
      setFeedback("Informe um nome válido para o seu perfil.");
      return;
    }

    try {
      setSavingProfile(true);
      setFeedback(null);

      const { data, error } = await supabase.rpc("update_player_profile", {
        p_player_id: player.id,
        p_name: trimmedName,
        p_photo_url: photoUrl.trim(),
        p_pix_key: pixKey.trim(),
      });

      if (error) throw error;

      const updated = (data?.[0] as UpdatePlayerProfileRow | undefined) ?? null;

      if (updated) {
        setPlayer((prev) =>
          prev
            ? {
              ...prev,
              name: updated.name,
              photo_url: updated.photo_url,
              pix_key: updated.pix_key,
            }
            : prev
        );

        const stored = localStorage.getItem("poker-session");
        if (stored) {
          const parsed = JSON.parse(stored) as PokerSession;
          parsed.playerName = updated.name;
          localStorage.setItem("poker-session", JSON.stringify(parsed));
          setSession(parsed);
        }
      }

      setFeedback("Seu perfil foi atualizado com sucesso.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file || !player || !session) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedback("A imagem deve ter no máximo 2MB.");
      return;
    }

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setFeedback("Formato inválido. Use PNG, JPG ou WEBP.");
      return;
    }

    try {
      setUploadingPhoto(true);
      setFeedback(null);

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `${session.groupId}/${player.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("player-avatars")
        .upload(fileName, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("player-avatars")
        .getPublicUrl(fileName);

      setPhotoUrl(publicUrlData.publicUrl);
      setFeedback("Foto enviada com sucesso. Clique em salvar perfil para concluir.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro ao enviar a foto.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  async function handleCopyCode() {
    if (!group?.code) return;
    await navigator.clipboard.writeText(group.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  }

  async function handleCopyLink() {
    const link = `${window.location.origin}/${groupCode}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  }

  function handleLogout() {
    localStorage.removeItem("poker-session");
    router.replace(`/${groupCode}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando configurações...
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardContent className="p-8">
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {pageError}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie o grupo e personalize o seu perfil.
        </p>
      </div>

      {feedback && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/15 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2 text-2xl">
              <Settings className="size-5" />
              Informações do grupo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
              <p className="text-sm text-muted-foreground">Nome do grupo</p>
              <p className="mt-1 font-heading text-xl font-semibold">
                {group?.name ?? "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
              <p className="text-sm text-muted-foreground">Código do grupo</p>
              <p className="mt-1 font-heading text-xl font-semibold">
                {group?.code ?? "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={handleCopyCode}
              >
                {copiedCode ? (
                  <Check className="mr-2 size-4" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copiedCode ? "Código copiado" : "Copiar código"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={handleCopyLink}
              >
                {copiedLink ? (
                  <Check className="mr-2 size-4" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copiedLink ? "Link copiado" : "Copiar link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2 text-2xl">
              <User className="size-5" />
              Meu perfil
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
              <p className="text-sm text-muted-foreground">Perfil atual</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-card">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={playerName || "Foto do jogador"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="size-7 text-muted-foreground" />
                  )}
                </div>

                <div>
                  <p className="font-heading text-lg font-semibold">
                    {playerName || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {session?.isAdmin ? "Administrador" : "Jogador"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">Foto do perfil</label>

              <div className="flex items-center gap-4">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-card">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={playerName || "Foto do jogador"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-7 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handlePhotoSelected}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
                  />

                  <p className="mt-2 text-xs text-muted-foreground">
                    PNG, JPG ou WEBP, com até 2MB.
                  </p>
                </div>
              </div>

              {uploadingPhoto && (
                <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                  Enviando foto...
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Seu nome</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Chave Pix</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="h-12 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile || uploadingPhoto}
              className="h-12 rounded-full"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Salvar perfil
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2 text-2xl">
              <Shield className="size-5" />
              Configurações do grupo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {!session?.isAdmin ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                Apenas administradores podem editar o nome do grupo.
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Nome do grupo
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleSaveGroupName}
                  disabled={savingGroupName}
                  className="h-12 rounded-full"
                >
                  {savingGroupName ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-4" />
                      Salvar nome do grupo
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Segurança do grupo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {!session?.isAdmin ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                Apenas administradores podem alterar a senha do grupo.
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="h-12 rounded-full"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-4" />
                      Atualizar senha
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-2xl">
            <LogOut className="size-5" />
            Sessão atual
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Você está usando o grupo como</p>
            <p className="mt-1 font-medium text-foreground">
              {session?.playerName} — {session?.isAdmin ? "Administrador" : "Jogador"}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 size-4" />
            Sair desta sessão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}