"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createMedia } from "@/app/(admin)/media/actions";
import { IDLE } from "@/lib/action-state";
import {
  CAPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  MAX_CAPTIONS,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  VIBES,
  type Vibe,
} from "@/lib/captions";
import { resizeImage } from "@/lib/resize-image";
import { ActionMessage } from "@/components/action-message";

type Mode = "gemini" | "manual";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";

function choiceClass(selected: boolean) {
  return `flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-focus-visible:ring-2 has-focus-visible:ring-blue-500/40 ${
    selected
      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
      : "border-zinc-200 bg-surface hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
  }`;
}

const MODES: Record<Mode, { emoji: string; label: string; blurb: string }> = {
  gemini: {
    emoji: "✨",
    label: "Let Gemini write 3 captions",
    blurb: "Same prompt and models as the main app",
  },
  manual: {
    emoji: "✍️",
    label: "Write them myself",
    blurb: `1 to ${MAX_CAPTIONS} captions, saved with the model “manual”`,
  },
};

// Same flow as the main app's create form: shrink the photo in the browser,
// preview it, then send the shrunken File with the rest of the form.
export function CreateMediaForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [vibe, setVibe] = useState<Vibe>("midwest");
  const [mode, setMode] = useState<Mode>("gemini");
  const [captionBoxes, setCaptionBoxes] = useState(3);
  const [state, formAction, pending] = useActionState(createMedia, IDLE);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoError(null);
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Please choose a JPEG, PNG or WebP photo.");
      return;
    }
    try {
      const resized = await resizeImage(file);
      if (resized.size > PHOTO_MAX_BYTES) {
        setPhotoError("That photo is still over 3 MB after shrinking. Try a smaller one.");
        return;
      }
      setPhoto(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch {
      setPhotoError("Couldn't read that photo. Try a JPEG or PNG.");
    }
  }

  // Submitted by hand (not <form action>) so a failed attempt keeps the photo
  // and inputs instead of resetting the form.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      setPhotoError("Pick a photo first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("photo", photo);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        onChange={handlePhoto}
        className="hidden"
      />
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-describedby="photo-hint"
          className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-surface text-zinc-500 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-wait dark:border-zinc-700 dark:hover:text-blue-400"
        >
          {previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="The photo you picked" className="h-full w-full object-contain" />
              <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-sm text-white transition group-focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                Change photo
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-2 px-6 text-center">
              <span className="text-4xl" aria-hidden>
                📸
              </span>
              <span className="font-medium">Choose a photo</span>
            </span>
          )}
        </button>
        <p id="photo-hint" className="mt-2 text-xs text-zinc-500">
          JPEG, PNG or WebP. It&apos;s shrunk to 1600 px in your browser before uploading.
        </p>
        {photoError && (
          <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {photoError}
          </p>
        )}
      </div>

      {/* Locked while saving, so the button's label matches what was sent. */}
      <fieldset disabled={pending}>
        <legend className="text-sm font-medium">Vibe</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(Object.keys(VIBES) as Vibe[]).map((key) => (
            <label key={key} className={choiceClass(vibe === key)}>
              <input
                type="radio"
                name="vibe"
                value={key}
                checked={vibe === key}
                onChange={() => setVibe(key)}
                className="sr-only"
              />
              <span className="text-2xl" aria-hidden>
                {VIBES[key].emoji}
              </span>
              <span>
                <span className="block font-medium">{VIBES[key].label}</span>
                <span className="block text-sm text-zinc-500">{VIBES[key].blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="text-sm font-medium">
        Location <span className="font-normal text-zinc-500">(optional)</span>
        <input
          name="location"
          maxLength={LOCATION_MAX_LENGTH}
          placeholder="e.g. Washington Square Park"
          disabled={pending}
          className={inputClass}
        />
      </label>

      <fieldset disabled={pending}>
        <legend className="text-sm font-medium">Captions</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(Object.keys(MODES) as Mode[]).map((key) => (
            <label key={key} className={choiceClass(mode === key)}>
              <input
                type="radio"
                name="mode"
                value={key}
                checked={mode === key}
                onChange={() => setMode(key)}
                className="sr-only"
              />
              <span className="text-2xl" aria-hidden>
                {MODES[key].emoji}
              </span>
              <span>
                <span className="block font-medium">{MODES[key].label}</span>
                <span className="block text-sm text-zinc-500">{MODES[key].blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Hidden and disabled rather than removed, so switching modes back and
          forth keeps what was typed, and Gemini mode doesn't send it. */}
      <fieldset
        hidden={mode !== "manual"}
        disabled={mode !== "manual" || pending}
        className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-surface p-4 dark:border-zinc-800"
      >
        <legend className="sr-only">Your captions</legend>
        <p className="text-sm text-zinc-500">
          Up to {MAX_CAPTIONS}, {CAPTION_MAX_LENGTH} characters each. Empty boxes are skipped.
        </p>
        {Array.from({ length: captionBoxes }, (_, index) => (
          <label key={index} className="text-sm font-medium">
            Caption {index + 1}
            <input name="caption" maxLength={CAPTION_MAX_LENGTH} className={inputClass} />
          </label>
        ))}
        {captionBoxes < MAX_CAPTIONS && (
          <button
            type="button"
            onClick={() => setCaptionBoxes((count) => Math.min(MAX_CAPTIONS, count + 1))}
            className="self-start rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            + Another caption
          </button>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {mode === "gemini"
            ? pending
              ? "Gemini is writing captions…"
              : "Generate captions ✨"
            : pending
              ? "Saving…"
              : "Create photo"}
        </button>
        {pending && mode === "gemini" && (
          <p className="text-sm text-zinc-500">This can take up to a minute when Gemini is busy.</p>
        )}
      </div>

      <ActionMessage state={state} />
    </form>
  );
}
