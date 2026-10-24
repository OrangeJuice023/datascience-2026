import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** A panel on the sheet: one 1px edge, no shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-border bg-sheet", className)}
      {...props}
    />
  );
}
