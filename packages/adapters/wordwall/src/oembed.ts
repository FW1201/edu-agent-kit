import { httpRequest } from "@interactive-edtech/mcp-shared";

/** Wordwall's public oEmbed endpoint — the ONLY public read API it offers. */
export const WORDWALL_OEMBED_ENDPOINT = "https://wordwall.net/about/oembed";

/** oEmbed response formats supported by the endpoint. */
export type OembedFormat = "json" | "xml";

/**
 * oEmbed "rich" response for a Wordwall activity. Fields follow the oEmbed 1.0
 * spec; only `type`/`version` are guaranteed, the rest are best-effort.
 */
export interface WordwallOembed {
  type: string;
  version: string;
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  html?: string;
  width?: number;
  height?: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  [key: string]: unknown;
}

/**
 * Fetch oEmbed metadata for a published Wordwall activity URL.
 *
 * Performs a real GET against {@link WORDWALL_OEMBED_ENDPOINT} with the
 * `url`/`format` query parameters. This is read-only and unauthenticated.
 */
export async function getOembed(
  activityUrl: string,
  format: OembedFormat = "json",
): Promise<WordwallOembed> {
  return httpRequest<WordwallOembed>(WORDWALL_OEMBED_ENDPOINT, {
    method: "GET",
    query: { url: activityUrl, format },
    headers: { Accept: "application/json" },
  });
}
