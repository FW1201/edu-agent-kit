/**
 * @edu-agent-kit/wordwall
 *
 * Wordwall adapter. Wordwall has NO content-creation API and every item is
 * entered by hand in the web editor; its only public API is read-only oEmbed.
 * This adapter therefore offers honest helpers:
 *   - build paste-ready CSV/TXT content for the major template families, and
 *   - fetch oEmbed metadata for a published activity.
 */
export { wordwallTools } from "./tools.js";
export {
  buildWordwallContent,
  type WordwallTemplate,
  type WordwallContentInput,
  type WordwallContent,
  type WordwallPair,
  type WordwallGroup,
} from "./content.js";
export {
  getOembed,
  WORDWALL_OEMBED_ENDPOINT,
  type WordwallOembed,
  type OembedFormat,
} from "./oembed.js";
