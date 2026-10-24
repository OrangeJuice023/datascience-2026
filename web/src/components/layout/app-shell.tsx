"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { SidebarContent } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * The app frame: sidebar and top bar share one sand-tinted ground (the "frame")
 * with no rule between them, and every page sits on a white sheet inset 8px
 * from the window's right and bottom edges. On phones the frame folds away:
 * the sheet is the screen and the navigation opens as a full-height sheet.
 */
export function AppShell({
  children,
  logoSrc,
}: {
  children: ReactNode;
  logoSrc?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the phone navigation whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-frame text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 lg:flex">
        <SidebarContent logoSrc={logoSrc} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 flex h-full w-[296px] max-w-[85vw] flex-col bg-frame shadow-[0_12px_32px_rgba(34,35,31,0.18)]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-frame-active"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent logoSrc={logoSrc} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} logoSrc={logoSrc} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 bg-sheet px-4 py-5 focus:outline-none sm:px-6 sm:py-6 lg:mb-2 lg:mr-2 lg:rounded-[var(--radius-sheet)] lg:border lg:border-border lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
