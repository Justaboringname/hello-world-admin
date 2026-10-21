// Chart colors, by the job each one does. Light and dark are separate steps of
// the same hues, checked for color-blind separation and contrast against our
// card surfaces (#ffffff and #131316), so treat them as a set: change one and
// re-check the others. Tailwind finds these classes by reading this file, so
// keep each one a whole, literal class name.

// One color per thing we count, the same in every chart on the page.
export const SERIES = {
  votes: "bg-[#2a78d6] dark:bg-[#3987e5]",
  posts: "bg-[#eb6834] dark:bg-[#d95926]",
  signups: "bg-[#1baf7a] dark:bg-[#199e70]",
} as const;

export type SeriesKey = keyof typeof SERIES;

// A meter's unfilled track: a lighter step of its fill, so the whole bar
// reads as one measure.
export const SIGNUPS_TRACK = "bg-[#1baf7a]/20 dark:bg-[#199e70]/30";

// 👍 and 👎 are opposites, so they get opposite hues (cool and warm). Every
// page's 👍/👎 bar uses these, through components/up-down-bar.tsx.
export const UP = "bg-[#2a78d6] dark:bg-[#3987e5]";
export const DOWN = "bg-[#e34948] dark:bg-[#e66767]";

// Nothing to show yet: an hour without votes, a split bar without votes.
export const EMPTY = "bg-zinc-100 dark:bg-zinc-800";

// The context a highlighted part is compared with (last week, in a sparkline).
export const CONTEXT = "bg-zinc-300 dark:bg-zinc-700";

// Votes per hour: more is darker on white and lighter on the dark surface,
// so busy hours always stand out from the card.
export const HEAT = [
  "bg-[#b7d3f6] dark:bg-[#104281]",
  "bg-[#86b6ef] dark:bg-[#1c5cab]",
  "bg-[#5598e7] dark:bg-[#2a78d6]",
  "bg-[#2a78d6] dark:bg-[#5598e7]",
  "bg-[#1c5cab] dark:bg-[#86b6ef]",
  "bg-[#104281] dark:bg-[#b7d3f6]",
] as const;

// Funnel stages: one step deeper per stage, so the order shows in the color.
export const STAGES = [
  "bg-[#86b6ef] dark:bg-[#184f95]",
  "bg-[#5598e7] dark:bg-[#256abf]",
  "bg-[#2a78d6] dark:bg-[#3987e5]",
  "bg-[#1c5cab] dark:bg-[#6da7ec]",
  "bg-[#104281] dark:bg-[#9ec5f4]",
] as const;

// Week-over-week changes. These are text, so they clear 4.5:1 on the card,
// and they always come with ▲ or ▼ so color is never the only signal.
export const GOOD_TEXT = "text-[#006300] dark:text-[#0ca30c]";
export const BAD_TEXT = "text-[#d03b3b] dark:text-[#f87171]";
