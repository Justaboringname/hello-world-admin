import { supabaseEnv } from "@/lib/supabase/env";

const sizes = {
  sm: "h-8 w-8 text-xs",
  lg: "h-24 w-24 text-3xl",
};

// Users can write any URL into their own profiles.avatar_url from the browser
// console, but the app only ever saves avatars-bucket URLs. Anything else is
// dropped (initials show instead): an admin page shouldn't load an image from
// a host a user picked, which would tell them who is looking and when.
function ownAvatarUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(supabaseEnv().url).origin &&
      parsed.pathname.startsWith("/storage/v1/object/public/avatars/")
      ? url
      : null;
  } catch {
    return null;
  }
}

export function Avatar({
  src,
  name,
  size = "sm",
}: {
  src: string | null | undefined;
  name: string;
  size?: keyof typeof sizes;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?";

  const safeSrc = ownAvatarUrl(src);
  if (safeSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safeSrc}
        loading="lazy"
        alt={`${name}'s profile photo`}
        className={`${sizes[size]} shrink-0 overflow-hidden rounded-full bg-zinc-200 object-cover dark:bg-zinc-800`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}
    >
      {initials}
    </span>
  );
}
