import { domToPng } from "modern-screenshot";

import {
  fetchShareResourceAsDataUrl,
  inlineImagesForShareCapture,
} from "@/lib/share-capture-inline-images";

type CaptureSharePngOpts = {
  width: number;
  height: number;
  pixelRatio?: number;
  backgroundColor: string;
};

/**
 * modern-screenshot corrige o bug do WebKit ao decodificar svg+xml antes do
 * drawImage (Safari iOS); html-to-image não aplica esse workaround.
 */
export async function captureShareCardToPng(
  node: HTMLElement,
  opts: CaptureSharePngOpts
): Promise<string> {
  const restore = await inlineImagesForShareCapture(node);
  try {
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await domToPng(node, {
      width: opts.width,
      height: opts.height,
      scale: opts.pixelRatio ?? 1,
      backgroundColor: opts.backgroundColor,
      style: { transform: "none" },
      timeout: 120_000,
      drawImageInterval: 120,
      features: {
        fixSvgXmlDecode: true,
        removeAbnormalAttributes: true,
        removeControlCharacter: true,
      },
      fetchFn: (url) => fetchShareResourceAsDataUrl(url),
    });
  } finally {
    restore();
  }
}
