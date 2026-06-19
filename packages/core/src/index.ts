/**
 * @edu-agent-kit/core
 *
 * Frozen content-model contract shared by every adapter and the server.
 * Exports: data models (Zod schemas + inferred types), pedagogy helpers
 * (Bloom distribution, depth scoring, generation briefs), and validators.
 */

// Models
export * from "./models/common.js";
export * from "./models/curriculum.js";
export * from "./models/source.js";
export * from "./models/question.js";
export * from "./models/quiz.js";
export * from "./models/lesson.js";
export * from "./models/board.js";

// Pedagogy
export * from "./pedagogy/bloom.js";
export * from "./pedagogy/prompts.js";

// Validation
export * from "./validate/content.js";
