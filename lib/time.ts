const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

// "5 minutes ago", "yesterday", ...
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    // Rounded, not truncated: 47 hours ago is "2 days ago", not "yesterday",
    // so it agrees with the date shown next to it.
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

// Midnight in New York, today. Our users live there, so "today" means their
// day, not the server's (UTC on Vercel).
export function startOfTodayInNewYork(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hourCycle: "h23",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(now)
      .map((part) => [part.type, Number(part.value)]),
  );
  const sinceMidnight =
    ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnight);
}

export function daysAgo(days: number, now = Date.now()) {
  return new Date(now - days * 24 * 60 * 60 * 1000);
}
