import { formatNumber } from "@/lib/format";

// The frame every dashboard chart sits in, plus the small pieces they share.
// Same card look as components/ui.tsx's Card, with room for a topic line above
// the title: the title says what the data shows, the topic says what it is.

export function Panel({
  id,
  topic,
  title,
  description,
  children,
  footer,
  className = "",
}: {
  id: string;
  topic: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-surface p-5 shadow-sm dark:border-zinc-800 ${className}`}
    >
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {topic}
        </p>
        <h2 id={`${id}-title`} className="mt-1 text-lg font-semibold leading-snug text-balance">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </header>
      <div className="flex-1">{children}</div>
      {footer && (
        <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {footer}
        </div>
      )}
    </section>
  );
}

// Keys for charts with two or more series. Swatches mirror the mark: a square
// for bars and cells.
export function Legend({ items }: { items: { label: React.ReactNode; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${item.color}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// Every chart's numbers as a plain table, for screen readers, keyboards and
// anyone who'd rather read than squint at bars.
export function TableView({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="group mt-4 text-sm">
      <summary className="w-fit cursor-pointer select-none rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
        <span className="group-open:hidden">Show as a table</span>
        <span className="hidden group-open:inline">Hide the table</span>
      </summary>
      <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 font-medium ${index ? "text-right" : ""}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row" className="whitespace-nowrap px-3 py-1.5 font-medium">
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className="px-3 py-1.5 text-right tabular-nums">
                      {typeof cell === "number" ? formatNumber(cell) : cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// A quiet "nothing here yet" for a chart with no data. Smaller than the
// shared EmptyState, which is sized for whole pages.
export function NoData({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </p>
  );
}

// Ranked lists start at 1.
export function Rank({ value }: { value: number }) {
  return (
    <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
      {value}
    </span>
  );
}
