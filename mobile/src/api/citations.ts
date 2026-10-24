/**
 * SIGI's citations, numbered for a plain-text reply.
 *
 * The server returns, with every reply, the evidence items the reply cites
 * that SIGI was actually given (`citations`) and the ids it named that it was
 * not given (`rejectedCitationIds`). Only the first become numbered sources,
 * so an id the model made up stays plain text and is never shown as a
 * source. Same rule as the web app (`linkServerCitations` in
 * web/src/lib/policy-chat/copilot-ui.ts), with "[n]" in place of a link
 * because the mobile client renders the reply as plain text.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function numberCitations<T extends { id: string }>(reply: string, citations: T[]): { text: string; cited: T[] } {
  if (citations.length === 0) return { text: reply, cited: [] };
  const byId = new Map(citations.map((c) => [c.id, c]));
  const ids = [...byId.keys()].sort((a, b) => b.length - a.length);
  // The prompt asks for [id]; brackets and backticks around an id are consumed with it.
  const pattern = new RegExp(`\\[?\`?(?<![\\w-])(${ids.map(escapeRegExp).join('|')})(?![\\w-])\`?\\]?`, 'g');
  const cited: T[] = [];
  const text = reply.replace(pattern, (_match, id: string) => {
    const item = byId.get(id)!;
    let n = cited.indexOf(item) + 1;
    if (n === 0) n = cited.push(item);
    return `[${n}]`;
  });
  // Items the server lists but the text never names still count as cited, after the numbered ones.
  for (const item of citations) if (!cited.includes(item)) cited.push(item);
  return { text, cited };
}

/**
 * The reply as plain text: Markdown headings, emphasis, inline code and
 * bullet markers are dropped so the words read cleanly in a Text element.
 * Nothing is added; a link keeps its address in brackets.
 */
export function plainReply(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Only http(s) addresses are opened from a citation. */
export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}
