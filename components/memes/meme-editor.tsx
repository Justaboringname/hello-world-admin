"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { updateMeme } from "@/app/(admin)/memes/actions";
import { Badge } from "@/components/ui";
import { IDLE } from "@/lib/action-state";
import { MEME_TEXT_MAX_LENGTH, MEME_TITLE_MAX_LENGTH } from "@/lib/captions";
import { ActionMessage } from "@/components/action-message";
import { memeAlt } from "./data";
import { MemeImage } from "./meme-image";

export type MemeFields = {
  title: string;
  topText: string;
  bottomText: string;
  membersOnly: boolean;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";

// The server saves each field as one line, so compare the same way.
function tidy(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

// Hidden from screen readers so it isn't read as part of the field's name;
// maxLength already stops typing at the limit.
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span
      aria-hidden
      className={`text-xs font-normal tabular-nums ${length > max ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}
    >
      {length}/{max}
    </span>
  );
}

// The meme, large, above its edit form. The picture follows what's typed, so
// the admin sees the new text on the image before saving it.
export function MemeEditor({
  memeId,
  imageUrl,
  saved,
}: {
  memeId: number;
  imageUrl: string;
  saved: MemeFields;
}) {
  const id = useId();
  const [fields, setFields] = useState(saved);
  const [state, formAction, pending] = useActionState(updateMeme.bind(null, memeId), IDLE);

  const title = tidy(fields.title);
  const topText = tidy(fields.topText);
  const bottomText = tidy(fields.bottomText);
  const dirty =
    title !== saved.title ||
    topText !== saved.topText ||
    bottomText !== saved.bottomText ||
    fields.membersOnly !== saved.membersOnly;

  function set<K extends keyof MemeFields>(key: K, value: MemeFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  // By hand rather than <form action>, which resets the form after every
  // submit: a failed save should keep what was typed. Save stays disabled
  // until something changes, so there's no submit before JavaScript loads.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex flex-col gap-6">
      <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-sm dark:border-zinc-800">
        <MemeImage
          src={imageUrl}
          alt={memeAlt({ title: title || saved.title })}
          topText={topText || null}
          bottomText={bottomText || null}
        />
        {dirty && (
          <figcaption className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-500">
            <Badge tone="amber">Preview</Badge> Not saved yet
          </figcaption>
        )}
      </figure>

      <section
        aria-labelledby={`${id}-heading`}
        className="rounded-2xl border border-zinc-200 bg-surface p-5 shadow-sm dark:border-zinc-800"
      >
        <h2 id={`${id}-heading`} className="font-semibold">
          Edit meme
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          The text and who can see it. The image, author and votes stay as posted.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="text-sm font-medium">
            <span className="flex items-baseline justify-between gap-2">
              Title <Counter length={title.length} max={MEME_TITLE_MAX_LENGTH} />
            </span>
            <input
              name="title"
              required
              maxLength={MEME_TITLE_MAX_LENGTH}
              value={fields.title}
              onChange={(event) => set("title", event.target.value)}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              <span className="flex items-baseline justify-between gap-2">
                <span>
                  Top text <span className="font-normal text-zinc-500">(optional)</span>
                </span>
                <Counter length={topText.length} max={MEME_TEXT_MAX_LENGTH} />
              </span>
              <input
                name="top_text"
                maxLength={MEME_TEXT_MAX_LENGTH}
                value={fields.topText}
                onChange={(event) => set("topText", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              <span className="flex items-baseline justify-between gap-2">
                <span>
                  Bottom text <span className="font-normal text-zinc-500">(optional)</span>
                </span>
                <Counter length={bottomText.length} max={MEME_TEXT_MAX_LENGTH} />
              </span>
              <input
                name="bottom_text"
                maxLength={MEME_TEXT_MAX_LENGTH}
                value={fields.bottomText}
                onChange={(event) => set("bottomText", event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <input
              type="checkbox"
              name="members_only"
              checked={fields.membersOnly}
              onChange={(event) => set("membersOnly", event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-blue-600"
            />
            <span>
              <span className="block font-medium">🔓 Members only</span>
              <span className="block text-zinc-500">
                Hidden from signed-out visitors. Everyone signed in still sees it.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!dirty || pending}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            {dirty && !pending && (
              <button
                type="button"
                onClick={() => setFields(saved)}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Undo changes
              </button>
            )}
          </div>

          {/* "Saved" only until the next edit; errors stay until fixed. */}
          {(state.status === "error" || !dirty) && <ActionMessage state={state} />}
        </form>
      </section>
    </div>
  );
}
