import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Claude writes the captions first (lib/gemini.ts generateCaptions).
// Whenever it can't (no ANTHROPIC_API_KEY, an error, a timeout, a refusal or
// an unusable answer), Gemini takes over with the time that's left.
export const CLAUDE_MODEL = "claude-opus-5-5";

// Claude's share of the caption deadline in lib/gemini.ts. Gemini keeps the
// rest, so a stalled Claude call still leaves it a full attempt.
const CLAUDE_TIMEOUT_MS = 22_000;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function isImageType(value: string): value is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(value);
}

// Why a Claude call gave up without throwing an API error: no key, a photo
// type Claude doesn't take, a safety refusal, or an answer that stopped early.
export class ClaudeCallError extends Error {
  constructor(readonly reason: "missing-key" | "unsupported-image" | "refused" | "incomplete") {
    super(`Claude call failed: ${reason}`);
  }
}

export type ClaudeJsonResult = { text: string; model: string };

// One structured-output request with the photo and the prompt. Returns the
// JSON text (the caller parses it) and the model that wrote it: with
// server-side fallback, a safety decline is retried on another Claude model
// inside the same request, so that can differ from CLAUDE_MODEL.
export async function claudeJson({
  image,
  mimeType,
  system,
  prompt,
  schema,
  signal,
}: {
  image: Buffer;
  mimeType: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<ClaudeJsonResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ClaudeCallError("missing-key");
  if (!isImageType(mimeType)) throw new ClaudeCallError("unsupported-image");

  // One quick retry for rate limits, overloads and dropped connections; the
  // signal caps the whole thing, retries included.
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: CLAUDE_TIMEOUT_MS });
  const response = await client.beta.messages.create(
    {
      model: CLAUDE_MODEL,
      // Thinking counts toward this too. Adaptive thinking is always on for
      // this model; low effort keeps it short, since people are waiting. Rate
      // limits count max_tokens up front, and 22 s can't produce more anyway.
      max_tokens: 4_096,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: image.toString("base64") },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    },
    { signal: AbortSignal.any([signal, AbortSignal.timeout(CLAUDE_TIMEOUT_MS)]) },
  );

  if (response.stop_reason === "refusal") throw new ClaudeCallError("refused");
  if (response.stop_reason !== "end_turn") throw new ClaudeCallError("incomplete");

  // A fallback block marks where a declining model stopped: only the text after
  // the last one is the answer. Thinking blocks come back empty and are skipped.
  const lastFallback = response.content.findLastIndex((block) => block.type === "fallback");
  const text = response.content
    .slice(lastFallback + 1)
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  return { text, model: response.model };
}
