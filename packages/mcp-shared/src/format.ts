/** Maximum response size before truncation, to protect agent context. */
export const CHARACTER_LIMIT = 25000;

export interface PaginationInput {
  limit: number;
  offset: number;
}

export interface Paginated<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}

/** Build a standard paginated envelope from a full result set. */
export function paginate<T>(
  all: T[],
  { limit, offset }: PaginationInput,
): Paginated<T> {
  const items = all.slice(offset, offset + limit);
  const has_more = offset + items.length < all.length;
  return {
    total: all.length,
    count: items.length,
    offset,
    items,
    has_more,
    ...(has_more ? { next_offset: offset + items.length } : {}),
  };
}

/**
 * Truncate a JSON-serializable payload's text representation if it exceeds
 * CHARACTER_LIMIT, returning a message to guide the agent.
 */
export function truncateText(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= CHARACTER_LIMIT) return { text, truncated: false };
  return {
    text:
      text.slice(0, CHARACTER_LIMIT) +
      `\n\n…[truncated ${text.length - CHARACTER_LIMIT} chars. Narrow your query, add filters, or use pagination.]`,
    truncated: true,
  };
}

/** Render a simple object as a Markdown bullet list (display name + id style). */
export function objectToMarkdown(
  obj: Record<string, unknown>,
  title?: string,
): string {
  const lines: string[] = [];
  if (title) lines.push(`# ${title}`, "");
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const val =
      typeof v === "object" ? JSON.stringify(v) : String(v);
    lines.push(`- **${k}**: ${val}`);
  }
  return lines.join("\n");
}
