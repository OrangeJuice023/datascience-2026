"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A copilot reply rendered as Markdown. react-markdown builds React
 * elements and ignores raw HTML, so model output can never inject markup.
 * Links are limited to in-page citations (`#cite-…`, produced by
 * `linkServerCitations` from the server's verified citations) and http(s)
 * URLs; anything else renders as plain text.
 */
function components(anchorPrefix: string): Components {
  return {
  h1: ({ children }) => <h3 className="mt-4 text-sm font-semibold text-ink first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 text-sm font-semibold text-ink first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 text-sm font-semibold text-slate-800 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-3 text-sm font-medium text-slate-800 first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  hr: () => <hr className="my-3 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
  ),
  code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.8em] text-slate-700">{children}</code>,
  pre: ({ children }) => <div className="mt-2 overflow-x-auto">{children}</div>,
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto rounded-[var(--radius-control)] border border-border">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="text-slate-600">{children}</thead>,
  th: ({ children }) => <th className="border-b border-border px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-rule px-3 py-2 align-top text-slate-700">{children}</td>,
  a: ({ href, children }) => {
    if (href?.startsWith("#cite-")) {
      return (
        <a
          href={`#${anchorPrefix}-${href.slice("#cite-".length)}`}
          className="mx-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded bg-accent-soft px-1 align-super text-[0.75em] font-semibold text-accent ring-1 ring-teal-200 no-underline hover:bg-teal-100"
        >
          {children}
        </a>
      );
    }
    if (href && /^https?:\/\//i.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
          {children}
        </a>
      );
    }
    return <>{children}</>;
  },
  };
}

/** `anchorPrefix` keeps each answer's citation anchors unique on the page. */
export function CopilotAnswer({ text, anchorPrefix }: { text: string; anchorPrefix: string }) {
  return (
    <div className="text-sm leading-relaxed text-ink">
      <Markdown remarkPlugins={[remarkGfm]} components={components(anchorPrefix)}>
        {text}
      </Markdown>
    </div>
  );
}
