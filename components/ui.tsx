import Link from "next/link";

// Small building blocks shared by every admin page, so they look alike.

// A link inside a sentence or a list: "Clear filters", "See all".
export const linkClass = "font-medium text-blue-600 hover:underline dark:text-blue-400";

// "← All users" at the top of a detail page.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
      ← {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-surface p-5 shadow-sm dark:border-zinc-800 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400 dark:border-zinc-700">
      {children}
    </p>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    >
      {children}
    </p>
  );
}

// PostgREST's codes for a missing function (PGRST202) and a missing table or
// view (PGRST205). Every admin_* one comes from admin.sql, so it likely hasn't
// been run.
const SETUP_CODES = ["PGRST202", "PGRST205"];

export function LoadError({ what, error }: { what: string; error: { code?: string; message: string } }) {
  return (
    <ErrorNote>
      Couldn&apos;t load {what}: {error.message || "the database didn't answer."}
      {error.code && SETUP_CODES.includes(error.code) && " Has admin/supabase/admin.sql been run in the SQL Editor?"}
    </ErrorNote>
  );
}

// Deleting sits in its own red card, apart from the everyday edits.
export function DangerZone({ description, children }: { description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="danger-zone"
      className="rounded-2xl border border-red-200 bg-surface p-5 shadow-sm dark:border-red-900/60"
    >
      <h2 id="danger-zone" className="font-semibold text-red-700 dark:text-red-400">
        Danger zone
      </h2>
      <p className="mb-4 mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      {children}
    </section>
  );
}

// One label and its value in a <dl>: side by side from sm up in a divided
// list ("row"), or the label above the value in a grid of facts ("stacked").
export function Detail({
  label,
  layout = "row",
  children,
}: {
  label: string;
  layout?: "row" | "stacked";
  children: React.ReactNode;
}) {
  if (layout === "stacked") {
    return (
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400 sm:w-24">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm">{children}</dd>
    </div>
  );
}

// A photo or meme as people see it in the main app, in a new tab.
export function ViewInAppLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
      View in app ↗
    </a>
  );
}

const BADGE_TONES = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// A GET form: the search lives in the URL, so results can be linked and the
// back button works. Extra hidden fields keep the other filters.
export function SearchBox({
  action,
  defaultValue,
  placeholder,
  hidden = {},
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} role="search" className="flex w-full max-w-md gap-2">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Search
      </button>
    </form>
  );
}

// Links that keep the current filters. `params` holds them; empty ones are
// dropped so URLs stay short.
export function hrefWith(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

// Previous / next for zero-based `page`. `total` is the exact row count.
export function Pagination({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const enabledClass =
    "rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
  const disabledClass =
    "rounded-full border border-zinc-200 px-4 py-1.5 text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600";

  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4">
      {page > 0 ? (
        <Link href={hrefWith(path, { ...params, page: page > 1 ? page : undefined })} className={enabledClass}>
          ← Previous
        </Link>
      ) : (
        <span className={disabledClass}>← Previous</span>
      )}
      <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
        Page {Math.min(page + 1, pages)} of {pages}
      </span>
      {page + 1 < pages ? (
        <Link href={hrefWith(path, { ...params, page: page + 2 })} className={enabledClass}>
          Next →
        </Link>
      ) : (
        <span className={disabledClass}>Next →</span>
      )}
    </nav>
  );
}

// Filter chips (e.g. All / 👍 / 👎) that link to the same page.
export function FilterTabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: React.ReactNode; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            item.active
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
