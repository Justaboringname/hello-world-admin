"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/users", label: "Users", icon: "👥" },
  { href: "/media", label: "AI media", icon: "✨" },
  { href: "/memes", label: "Memes", icon: "😂" },
  { href: "/votes", label: "Votes", icon: "👍" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Sidebar links on wide screens. Below that, all five fit in one row of tabs
// (icon over label on phones), so the current section is always in view.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="grid grid-cols-5 gap-1 lg:flex lg:flex-col">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-medium transition sm:flex-row sm:justify-center sm:gap-2 sm:px-3 sm:py-2 sm:text-sm lg:justify-start lg:gap-2.5 ${
              active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <span aria-hidden className="text-base sm:text-sm">
              {item.icon}
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
