function isDataUrl(src: string): boolean {
  return src.startsWith("data:");
}

function proxyUrlForRemoteImage(absoluteUrl: string): string {
  return `/api/share-proxy-image?url=${encodeURIComponent(absoluteUrl)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/** Usado pelo modern-screenshot `fetchFn` quando o clone ainda tem URLs http(s). */
export async function fetchShareResourceAsDataUrl(
  resourceUrl: string
): Promise<string | false> {
  const trimmed = resourceUrl.trim();
  if (!trimmed || isDataUrl(trimmed)) return trimmed || false;

  if (trimmed.startsWith("blob:")) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return false;
      return await blobToDataUrl(await res.blob());
    } catch {
      return false;
    }
  }

  try {
    const absolute = new URL(trimmed, window.location.href).href;
    const origin = window.location.origin;
    const fetchUrl = absolute.startsWith(origin)
      ? absolute
      : proxyUrlForRemoteImage(absolute);

    const res = await fetch(fetchUrl);
    if (!res.ok) return false;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return false;
  }
}

/**
 * Troca temporariamente `src` de cada <img> por blob URL (mais leve que data URL
 * gigante no SVG do WebKit). Chame o retorno após a captura.
 */
export async function inlineImagesForShareCapture(
  root: HTMLElement
): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const restores: { el: HTMLImageElement; src: string; objectUrl: string }[] =
    [];

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
      const objectUrl = URL.createObjectURL(blob);
      restores.push({ el: img, src: img.src, objectUrl });
      img.src = objectUrl;
      await img.decode().catch(() => undefined);
    } catch {
      /* mantém src original */
    }
  }

  return () => {
    for (const { el, src, objectUrl } of restores) {
      URL.revokeObjectURL(objectUrl);
      el.src = src;
    }
  };
}
