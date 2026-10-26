import { pageTitle } from "@/lib/format";
import { safeJsonLd } from "@/lib/jsonld";
import { useSite } from "../SiteContext";

interface Props {
  /** Page name, e.g. "Rooms". Omit on the home page. */
  page?: string;
  /** Overrides the computed title entirely (CMS page SEO). */
  titleOverride?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  path: string;
  jsonLd?: Record<string, unknown>;
}

/**
 * Per-page metadata using React 19's built-in hoisting: <title>/<meta>/<link> rendered anywhere end up in <head>.
 * Note: crawlers that do not run JavaScript will not see these; prerendering is planned for Phase 6.
 */
export function Seo({ page, titleOverride, description, imageUrl, path, jsonLd }: Props) {
  const { hotel } = useSite();
  const title = titleOverride || pageTitle(hotel.seo.titleTemplate, hotel.name, page);
  const desc = description || hotel.seo.defaultDescription || hotel.description || hotel.tagline || undefined;
  const url = `${window.location.origin}${path}`;
  const image = imageUrl ?? hotel.seo.ogImage?.url ?? null;
  const absoluteImage = image ? new URL(image, window.location.origin).href : null;

  return (
    <>
      <title>{title}</title>
      {desc && <meta name="description" content={desc} />}
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={hotel.name} />
      <meta property="og:title" content={title} />
      {desc && <meta property="og:description" content={desc} />}
      <meta property="og:url" content={url} />
      {absoluteImage && <meta property="og:image" content={absoluteImage} />}
      <meta name="twitter:card" content={absoluteImage ? "summary_large_image" : "summary"} />
      <meta name="theme-color" content={hotel.branding.primaryColor} />
      {hotel.branding.favicon && <link rel="icon" href={hotel.branding.favicon.url} />}
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />}
    </>
  );
}
