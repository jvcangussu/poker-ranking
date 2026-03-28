import { toPng } from "html-to-image";

import { inlineImagesForShareCapture } from "@/lib/share-capture-inline-images";

type CaptureSharePngOpts = {
  width: number;
  height: number;
  pixelRatio?: number;
  backgroundColor: string;
};

export async function captureShareCardToPng(
  node: HTMLElement,
  opts: CaptureSharePngOpts
): Promise<string> {
  const restore = await inlineImagesForShareCapture(node);
  try {
    return await toPng(node, {
      width: opts.width,
      height: opts.height,
      pixelRatio: opts.pixelRatio ?? 1,
      cacheBust: false,
      backgroundColor: opts.backgroundColor,
      style: {
        transform: "none",
      },
    });
  } finally {
    restore();
  }
}
