import type { Dashboard } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";

// Number helpers for the dashboard. A new database has lots of zeros and
// nulls, so every ratio here has an answer for "nothing to divide by".

// Below this many votes a rate swings on one person's mood, so headlines
// won't crown a winner on it.
export const FEW_VOTES = 10;

// part / whole, or null when there's no whole. Callers decide what "no data"
// looks like instead of getting NaN.
export function share(part: number, whole: number) {
  return whole > 0 ? part / whole : null;
}

// A bar length between 0 and 1. Nothing to compare with draws no bar.
export function fraction(part: number, whole: number) {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
}

// 0.723 -> "72%". null -> "–". A sliver that would round to "0%" says "<1%",
// so it doesn't read as none at all.
export function percent(value: number | null, digits = 0) {
  if (value === null) return "–";
  const smallest = 10 ** -digits;
  if (value > 0 && value * 100 < smallest / 2) return `<${smallest}%`;
  return `${(value * 100).toFixed(digits)}%`;
}

// Scores and changes: "+12", "−3", "0". A real minus sign, so columns line up.
export function signed(value: number, digits = 0) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return "0";
  const text = digits ? Math.abs(rounded).toFixed(digits) : formatNumber(Math.abs(rounded));
  return `${rounded > 0 ? "+" : "−"}${text}`;
}

// Average caption score, which is null when there are no captions to average.
export function averageScore(value: number | null) {
  return value === null ? "–" : signed(value, 1);
}

// One decimal for small numbers ("4.2"), none once it's big enough not to matter.
export function decimal(value: number) {
  return value < 10 ? value.toFixed(1).replace(/\.0$/, "") : formatNumber(Math.round(value));
}

// The top of a chart's scale: a round number at or just above the largest
// value, so the one tick label we show is easy to read.
export function niceMax(value: number) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  for (const step of steps) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

// Median minutes to a first vote, as people say it: "40 sec", "4 min", "2.5 h".
export function formatWait(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "–";
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  if (minutes < 60) return `${decimal(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${decimal(hours)} h`;
  return `${decimal(hours / 24)} days`;
}

// "1 meme", "3 memes".
export function plural(n: number, word: string, many = `${word}s`) {
  return `${formatNumber(n)} ${n === 1 ? word : many}`;
}

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// "12 AM", "3 PM".
export function hourName(hour: number) {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

// "10–11 PM", "11 PM–12 AM".
export function hourRange(hour: number) {
  const start = hourName(hour);
  const end = hourName((hour + 1) % 24);
  return start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)}–${end}` : `${start}–${end}`;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// The `day` strings from Postgres are New York calendar dates (YYYY-MM-DD).
// Read them at noon UTC and format in UTC, so no time zone can shift the date.
const shortDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const longDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function dayLabel(day: string, style: "short" | "long" = "short") {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return (style === "long" ? longDay : shortDay).format(date);
}

// Profiles without a name still need something to click on.
export function personName(name: string | null | undefined) {
  return name?.trim() || "Unnamed user";
}

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// This week against the 7 days before: the arrow, the change and its tone.
export function weekChange(current: number, previous: number) {
  if (current === previous) return { tone: "flat" as const, arrow: "–", text: "No change" };
  if (previous === 0) return { tone: "good" as const, arrow: "▲", text: "New" };
  const change = (current - previous) / previous;
  const text =
    change >= 10 ? `${Math.round(current / previous)}×` : `${Math.abs(Math.round(change * 100))}%`;
  if (text === "0%") return { tone: "flat" as const, arrow: "–", text: "No change" };
  return change > 0
    ? { tone: "good" as const, arrow: "▲", text }
    : { tone: "bad" as const, arrow: "▼", text };
}

function count(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function counts<T extends Record<string, number>>(value: unknown, keys: readonly (keyof T)[]) {
  const source = (value ?? {}) as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, count(source[key as string])])) as T;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// admin_dashboard() always sends every field, but a half-run admin.sql or an
// older copy of it might not. Fill the gaps so the page never shows NaN.
export function normalizeDashboard(raw: Dashboard): Dashboard {
  const week = ["users", "posts", "votes", "active_users"] as const;
  const kind = ["posts", "voted_posts", "upvotes", "downvotes"] as const;
  const minutes = raw.first_vote_minutes === null ? null : Number(raw.first_vote_minutes);
  return {
    generated_at: raw.generated_at ?? new Date().toISOString(),
    timezone: raw.timezone ?? "America/New_York",
    totals: counts<Dashboard["totals"]>(raw.totals, [
      "users",
      "admins",
      "photos",
      "captions",
      "memes",
      "user_memes",
      "votes",
      "upvotes",
      "downvotes",
      "voters",
      "posters",
      "unvoted_posts",
    ]),
    last_7_days: counts<Dashboard["last_7_days"]>(raw.last_7_days, week),
    previous_7_days: counts<Dashboard["previous_7_days"]>(raw.previous_7_days, week),
    daily: list<Dashboard["daily"][number]>(raw.daily).map((d) => ({
      day: String(d.day),
      signups: count(d.signups),
      photos: count(d.photos),
      memes: count(d.memes),
      votes: count(d.votes),
    })),
    heatmap: list<Dashboard["heatmap"][number]>(raw.heatmap),
    funnel: counts<Dashboard["funnel"]>(raw.funnel, [
      "signed_up",
      "named",
      "voted",
      "posted",
      "regulars",
    ]),
    vibes: list(raw.vibes),
    positions: list(raw.positions),
    decided_photos: count(raw.decided_photos),
    models: list(raw.models),
    kinds: {
      photo: counts<Dashboard["kinds"]["photo"]>(raw.kinds?.photo, kind),
      meme: counts<Dashboard["kinds"]["meme"]>(raw.kinds?.meme, kind),
    },
    top_captions: list(raw.top_captions),
    divisive_captions: list(raw.divisive_captions),
    top_memes: list(raw.top_memes),
    top_creators: list(raw.top_creators),
    top_voters: list(raw.top_voters),
    awards: {
      harshest_critic: raw.awards?.harshest_critic ?? null,
      biggest_fan: raw.awards?.biggest_fan ?? null,
      night_owl: raw.awards?.night_owl ?? null,
    },
    locations: list(raw.locations),
    first_vote_minutes: minutes !== null && Number.isFinite(minutes) ? minutes : null,
  };
}
