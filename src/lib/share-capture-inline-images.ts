function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function isDataUrl(src: string): boolean {
  return src.startsWith("data:");
}

function proxyUrlForRemoteImage(absoluteUrl: string): string {
  return `/api/share-proxy-image?url=${encodeURIComponent(absoluteUrl)}`;
}

/**
 * Troca temporariamente `src` de cada <img> por data URL, para o html-to-image
 * não falhar com CORS no Safari (fundo + avatares).
 * Chame o retorno após `toPng` para restaurar o DOM.
 */
export async function inlineImagesForShareCapture(
  root: HTMLElement
): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const restores: { el: HTMLImageElement; src: string }[] = [];

  for (const img of imgs) {
    const raw = img.getAttribute("src")?.trim() ?? "";
    if (!raw || isDataUrl(raw)) continue;

    let absolute: string;
    try {
      absolute = new URL(raw, window.location.href).href;
    } catch {
      continue;
    }

    try {
      const origin = window.location.origin;
      const fetchUrl = absolute.startsWith(origin)
        ? absolute
        : proxyUrlForRemoteImage(absolute);

      const res = await fetch(fetchUrl);
      if (!res.ok) continue;

      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      restores.push({ el: img, src: img.src });
      img.src = dataUrl;
      await img.decode().catch(() => undefined);
    } catch {
      /* mantém src; captura pode cair no fallback de iniciais */
    }
  }

  return () => {
    for (const { el, src } of restores) {
      el.src = src;
    }
  };
}
