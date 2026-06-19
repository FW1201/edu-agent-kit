/**
 * @edu-agent-kit/sources
 *
 * External-resource ingestion (the "外部資源容納" layer): turn files, URLs,
 * web-search results, and curriculum standards into SourceMaterial / alignment
 * objects the generation layer consumes.
 */
export { ingestFile } from "./files.js";
export { ingestUrl, webSearch } from "./web.js";
export {
  alignCurriculum,
  listCurriculumDomains,
  type AlignmentInput,
} from "./curriculum.js";
