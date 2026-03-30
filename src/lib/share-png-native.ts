/** HTTPS ou localhost — necessário para compartilhar arquivo em vários navegadores. */
export function isSecureShareContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

export type SharePngNativeResult =
  | "shared"
  | "aborted"
  | "no_share_api"
  | "failed";

/**
 * Abre o share nativo do sistema com o PNG. Várias combinações de
 * `ShareData` porque WebKit/Android se comportam diferente; não usa
 * `canShare` como bloqueio — ainda tenta `share()` para maximizar chances.
 */
export async function sharePngNative(
  file: File,
  options: { appMark: string }
): Promise<SharePngNativeResult> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (typeof nav?.share !== "function") {
    return "no_share_api";
  }

  const { appMark } = options;
  const attempts: ShareData[] = [
    { files: [file], title: appMark },
    { files: [file] },
    {
      files: [file],
      title: appMark,
      text: `${appMark} — imagem para Stories ou redes.`,
    },
  ];

  for (const data of attempts) {
    try {
      await nav.share(data);
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return "aborted";
      }
    }
  }

  return "failed";
}
