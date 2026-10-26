import type { IMediaAsset } from "./media.model.js";

export interface PublicImage {
  url: string;
  /** Responsive sizes (Cloudinary only). The browser picks the smallest that fits. */
  srcSet?: string | undefined;
  width: number;
  height: number;
  alt: string;
}

const WIDTHS = [480, 768, 1200, 1920];

const transform = (url: string, w: number) => url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${w}/`);

/** Public shape of an uploaded image, with responsive variants when the provider supports them. */
export function toPublicImage(asset: Pick<IMediaAsset, "provider" | "url" | "width" | "height" | "alt">, altFallback = ""): PublicImage {
  const alt = asset.alt || altFallback;
  if (asset.provider !== "cloudinary" || !asset.url.includes("/image/upload/")) return { url: asset.url, width: asset.width, height: asset.height, alt };
  const widths = WIDTHS.filter((w) => w <= asset.width);
  const usable = widths.length ? widths : [asset.width];
  return {
    url: transform(asset.url, Math.min(1200, asset.width)),
    srcSet: usable.map((w) => `${transform(asset.url, w)} ${w}w`).join(", "),
    width: asset.width,
    height: asset.height,
    alt,
  };
}
