/** Agents whose memory/core file the scaffolder can generate. */
export type AgentId = "claude" | "codex" | "opencode" | "gemini" | "cursor";

export const ALL_AGENTS: AgentId[] = ["claude", "codex", "opencode", "gemini", "cursor"];

/** Teacher profile that customizes generated memory/docs. */
export interface WikiProfile {
  teacherName?: string;
  gradeLevels?: string[];
  subjects?: string[];
  /** EdTech platforms the teacher uses (kahoot, padlet, nearpod, ...). */
  platforms?: string[];
  /** Google services enabled (docs, slides, forms, sheets, drive, classroom, firebase). */
  googleServices?: string[];
  /** Which agents to generate memory/core files for. */
  agents: AgentId[];
}

/** A wiki structure template. */
export interface WikiTemplate {
  id: string;
  title: string;
  description: string;
  /** Relative directories to create (always includes the raw/wiki/.cache core). */
  folders: string[];
}

export interface ScaffoldOptions {
  targetDir: string;
  templateId: string;
  profile: WikiProfile;
  /** Extra relative folders for customization. */
  extraFolders?: string[];
  /** If false, do not overwrite existing files (default false = safe). */
  overwrite?: boolean;
}

export interface ScaffoldResult {
  targetDir: string;
  templateId: string;
  createdDirs: string[];
  createdFiles: string[];
  skipped: string[];
}
