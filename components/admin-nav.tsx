"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_GROUPS = [
  {
    label: "Content",
    items: [
      { href: "/", label: "Dashboard", icon: "📊" },
      { href: "/users", label: "Users", icon: "👥" },
      { href: "/media", label: "AI media", icon: "✨" },
      { href: "/memes", label: "Memes", icon: "😂" },
      { href: "/votes", label: "Votes", icon: "👍" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/prompt-chains", label: "Prompt chains", icon: "⛓️" },
      { href: "/requests", label: "Requests & responses", icon: "📨" },
      { href: "/examples", label: "Examples", icon: "🧪" },
      { href: "/terms", label: "Terms", icon: "📖" },
    ],
  },
  {
    label: "Models",
    items: [
      { href: "/llm-models", label: "LLM models", icon: "🤖" },
      { href: "/llm-providers", label: "Providers", icon: "🏢" },
    ],
  },
  {
    label: "Access",
    items: [{ href: "/access", label: "Sign-up rules", icon: "🔐" }],
  },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Grouped sidebar links on wide screens. Below that, one row of tabs that
// scrolls sideways, so every section stays one tap away.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex shrink-0 gap-1 lg:flex-col">
          <p className="hidden px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-400 lg:block dark:text-zinc-500">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition lg:gap-2.5 lg:py-2 ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
