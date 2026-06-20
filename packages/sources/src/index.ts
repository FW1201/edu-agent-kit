/**
 * @edu-agent-kit/sources
 *
 * External-resource ingestion (the "外部資源容納" layer): turn files, URLs,
 * and curriculum standards into SourceMaterial / alignment objects the
 * generation layer consumes. Web search itself is left to the calling agent's
 * built-in capability — it does not require a dedicated API key here.
 */
export { ingestFile, ingestFolder, SUPPORTED_EXTS, type FolderIngestResult } from "./files.js";
export { ingestUrl } from "./web.js";
export {
  alignCurriculum,
  listCurriculumDomains,
  type AlignmentInput,
} from "./curriculum.js";
