const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatNumber(value: number) {
  return integer.format(value);
}

// 1.2K, 3.4M: for tiles and chart labels, not tables.
export function formatCompact(value: number) {
  return Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value);
}

// "1 caption", "3 captions".
export function plural(count: number, one: string, many = `${one}s`) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

// +3, 0, −2: a score or change with its sign, like the main app's vote
// buttons. A real minus sign (U+2212), so columns of numbers line up.
export function signedScore(value: number, digits = 0) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return "0";
  const text = digits ? Math.abs(rounded).toFixed(digits) : formatNumber(Math.abs(rounded));
  return `${rounded > 0 ? "+" : "−"}${text}`;
}

// The Badge tone for a score.
export function scoreTone(score: number) {
  return score > 0 ? "green" : score < 0 ? "red" : "neutral";
}

// part / whole as "42%", or "–" when there's nothing to divide by.
export function formatPercent(part: number, whole: number, digits = 0) {
  if (!whole) return "–";
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
  timeStyle: "short",
});
const dateOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
});

// Absolute times are New York time, like the dashboard's days and hours.
export function formatDateTime(iso: string | null | undefined) {
  return iso ? dateTime.format(new Date(iso)) : "–";
}

export function formatDate(iso: string | null | undefined) {
  return iso ? dateOnly.format(new Date(iso)) : "–";
}

export function fullName(
  person: { first_name?: string | null; last_name?: string | null } | null | undefined,
) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ");
}

// What to call someone on screen. Plenty of profiles have no name yet, and
// the views hand over names already joined (voter_name, author_name), so it
// takes either.
export function displayName(
  person: string | { first_name?: string | null; last_name?: string | null } | null | undefined,
) {
  const name = typeof person === "string" ? person.trim() : fullName(person);
  return name || "Unnamed user";
}

// A search box value, tidied: one line, no control characters (a NUL would
// cut the pattern short in Postgres), no runaway length. lib/search.ts makes
// it safe for PostgREST filters.
export function cleanSearch(value: string | undefined, maxLength = 80) {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

// ?page=3 -> 2 (zero-based). Anything odd falls back to the first page.
export function pageIndex(value: string | undefined) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 1 ? page - 1 : 0;
}

// Positive integer ids from route params and forms.
export function parseId(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

// User ids (auth.users.id) from ?user= and route params.
export function parseUuid(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}
