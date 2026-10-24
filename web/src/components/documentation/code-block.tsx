import { CopyButton } from "./copy-button";

/**
 * A labelled block of code.
 *
 * The label says what the block is — a request, a response — and the copy
 * button takes the whole thing, so the reader never has to select across
 * line numbers.
 */
export function CodeBlock({
  label,
  code,
  language = "bash",
  note,
}: {
  label: string;
  code: string;
  language?: "bash" | "json" | "typescript";
  note?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-500">
            {label}
          </p>
          {note ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{note}</p>
          ) : null}
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-slate-800">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}
