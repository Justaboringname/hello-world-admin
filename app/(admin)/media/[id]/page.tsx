import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashBanner } from "@/components/flash-banner";
import { AddCaptionForm, CaptionEditor } from "@/components/media/caption-editor";
import { MEDIA_DETAIL_COLUMNS, photoAlt, topCaptionId, type MediaDetail } from "@/components/media/data";
import { DeleteGenerationForm } from "@/components/media/delete-generation-form";
import { GenerationDetailsForm } from "@/components/media/generation-details-form";
import {
  BackLink,
  Card,
  DangerZone,
  Detail,
  LoadError,
  PageHeader,
  ViewInAppLink,
  hrefWith,
  linkClass,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { MANUAL_MODEL, MAX_CAPTIONS, vibeLabel } from "@/lib/captions";
import { displayName, formatDateTime, formatNumber, parseId, plural, signedScore } from "@/lib/format";
import { mainAppUrl } from "@/lib/links";
import { firstParam } from "@/lib/redirect";
import { photoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "AI photo" };

function Prompt({ label, text, empty }: { label: string; text: string; empty: string }) {
  return (
    <>
      <h3 className="mt-4 text-sm font-medium">{label}</h3>
      {text ? (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
          {text}
        </pre>
      ) : (
        <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-400">{empty}</p>
      )}
    </>
  );
}

export default async function MediaDetailPage({ params, searchParams }: PageProps<"/media/[id]">) {
  const { id: idParam } = await params;
  await requireAdmin(`/media/${encodeURIComponent(idParam)}`);
  const id = parseId(idParam);
  if (!id) notFound();
  const query = await searchParams;
  const created = firstParam(query.created) === "1";
  const captionDeleted = firstParam(query.captionDeleted) === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select(MEDIA_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink href="/media">All AI media</BackLink>
        <LoadError what="this photo" error={error} />
      </div>
    );
  }
  if (!data) notFound();

  const generation = data as MediaDetail;
  const captions = [...(generation.captions ?? [])].sort((a, b) => a.position - b.position);
  const upvotes = captions.reduce((sum, caption) => sum + caption.upvotes, 0);
  const downvotes = captions.reduce((sum, caption) => sum + caption.downvotes, 0);
  const topId = topCaptionId(captions);
  const isManual = generation.model === MANUAL_MODEL;
  const taken = new Set(captions.map((caption) => caption.position));
  const nextPosition = Array.from({ length: MAX_CAPTIONS }, (_, i) => i + 1).find((p) => !taken.has(p));
  const appUrl = mainAppUrl(`/p/${id}`);
  const src = photoUrl(generation.image_path);
  const author = displayName(generation.author_name);

  const appLink = appUrl && <ViewInAppLink href={appUrl} />;

  return (
    <div className="space-y-6">
      <BackLink href="/media">All AI media</BackLink>

      {created && (
        <FlashBanner param="created" title="🎉 Photo created">
          {isManual ? "Your" : "Gemini's"} {plural(captions.length, "caption is", "captions are")} live in
          the main app{appLink ? <>: {appLink}</> : "."}
        </FlashBanner>
      )}
      {captionDeleted && <FlashBanner param="captionDeleted" title="🗑️ Caption deleted, with its votes" />}

      <PageHeader
        title={`Photo #${id}`}
        description={
          <>
            {generation.location && <>📍 {generation.location} · </>}
            by {author} · {timeAgo(generation.created_at)}
          </>
        }
        actions={appLink}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-sm dark:border-zinc-800">
            <a href={src} target="_blank" rel="noreferrer" className="relative block overflow-hidden bg-zinc-900">
              {/* A blurred copy behind it, so tall or wide photos sit on their own colors. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={photoAlt(generation)}
                loading="lazy"
                className="relative mx-auto max-h-[36rem] w-full object-contain"
              />
            </a>
            <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="break-all font-mono">{generation.image_path}</span>
              <a href={src} target="_blank" rel="noreferrer" className={linkClass}>
                Full size ↗
              </a>
            </figcaption>
          </figure>

          <Card
            title="Captions"
            description={`${plural(captions.length, "caption")} of ${MAX_CAPTIONS} at most. Edit the wording here; votes only change when people vote.`}
          >
            {captions.length ? (
              <ul className="-my-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {captions.map((caption) => (
                  <CaptionEditor
                    key={caption.id}
                    caption={caption}
                    isTop={caption.id === topId}
                    canDelete={captions.length > 1}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-zinc-500 dark:text-zinc-400">This photo has no captions. Add one below.</p>
            )}
            <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800">
              {nextPosition ? (
                <AddCaptionForm generationId={id} position={nextPosition} />
              ) : (
                <p className="pt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  This photo has {MAX_CAPTIONS} captions, the most it can have. Delete one to add another.
                </p>
              )}
            </div>
          </Card>

          <details className="rounded-2xl border border-zinc-200 bg-surface p-5 shadow-sm dark:border-zinc-800">
            <summary className="cursor-pointer font-semibold">
              {isManual ? "How this photo was captioned" : "How Gemini was asked"}
            </summary>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Model <span className="font-mono text-zinc-900 dark:text-zinc-100">{generation.model}</span>. Saved
              exactly as {isManual ? "written" : "sent"} when the photo was posted; editing the location or
              vibe doesn&apos;t change it.
            </p>
            <Prompt
              label="System prompt"
              text={generation.system_prompt}
              empty="None: an admin wrote these captions by hand."
            />
            <Prompt label="Prompt (sent with the photo)" text={generation.prompt} empty="None." />
          </details>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card title="Details">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="rounded-xl bg-zinc-100 px-2 py-2.5 dark:bg-zinc-900">
                <p className="text-lg font-semibold">{formatNumber(upvotes)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">👍 total</p>
              </div>
              <div className="rounded-xl bg-zinc-100 px-2 py-2.5 dark:bg-zinc-900">
                <p className="text-lg font-semibold">{formatNumber(downvotes)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">👎 total</p>
              </div>
              <div className="rounded-xl bg-zinc-100 px-2 py-2.5 dark:bg-zinc-900">
                <p className="text-lg font-semibold">{signedScore(upvotes - downvotes)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Score</p>
              </div>
            </div>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <Detail label="Posted by">
                <Link href={`/users/${generation.user_id}`} className={linkClass}>
                  {author}
                </Link>{" "}
                ·{" "}
                <Link href={hrefWith("/media", { user: generation.user_id })} className="text-zinc-500 dark:text-zinc-400 hover:underline">
                  all their photos
                </Link>
              </Detail>
              <Detail label="Vibe">{vibeLabel(generation.vibe)}</Detail>
              <Detail label="Location">{generation.location || <span className="text-zinc-500 dark:text-zinc-400">–</span>}</Detail>
              <Detail label="Model">
                <span className="font-mono">{generation.model}</span>
                {isManual && <span className="text-zinc-500 dark:text-zinc-400"> (written by an admin)</span>}
              </Detail>
              <Detail label="Created">
                {formatDateTime(generation.created_at)}{" "}
                <span className="text-zinc-500 dark:text-zinc-400">({timeAgo(generation.created_at)})</span>
              </Detail>
              <Detail label="Votes">
                <span className="tabular-nums">
                  {plural(upvotes + downvotes, "vote")} on {plural(captions.length, "caption")}
                </span>
              </Detail>
            </dl>
          </Card>

          <Card title="Edit details" description="The author, prompt and date stay as posted.">
            <GenerationDetailsForm
              generationId={id}
              location={generation.location}
              vibe={generation.vibe}
            />
          </Card>

          <DangerZone
            description={`Deletes the photo for everyone, with its ${plural(captions.length, "caption")} and ${plural(upvotes + downvotes, "vote")}. Its image file is removed from Storage too, unless a meme uses it.`}
          >
            <DeleteGenerationForm
              generationId={id}
              captionCount={captions.length}
              voteCount={upvotes + downvotes}
            />
          </DangerZone>
        </aside>
      </div>
    </div>
  );
}
