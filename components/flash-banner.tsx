"use client";

import { useEffect } from "react";

// A one-time "it worked" banner after a redirect (?created=1, ?deleted=1).
// It drops its flag from the address bar, so a reload or a copied link
// doesn't show it again.
export function FlashBanner({
  param,
  title,
  children,
}: {
  param: string;
  title: string;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    // null, not history.state: Next.js only syncs its router with the new
    // URL when the state isn't already one of its own.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [param]);

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
    >
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-emerald-800 dark:text-emerald-300">{children}</div>}
    </div>
  );
}
