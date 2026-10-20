import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { VIBES, type Vibe } from "@/lib/captions";

// Flash-Lite models get about 500 free requests a day per project, Flash
// models about 20, so a free key starts on Flash-Lite. GEMINI_MODEL picks a
// different first choice (e.g. gemini-3.8-flash for better jokes, fewer
// requests). If the first model is overloaded, rate-limited or rejects the
// request, the other Flash-Lite model, which has its own quota, gets a turn.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

// Retried on the same model by the SDK: rate limits, "high demand" overloads
// (503), server errors and timeouts.
const RETRY_STATUSES = [408, 429, 500, 502, 503, 504];
const ATTEMPTS_PER_MODEL = 2;
const ATTEMPT_TIMEOUT_MS = 20_000;
// /media/new allows 60 s (maxDuration); leave time to upload and save afterwards.
const DEADLINE_MS = 50_000;
// A model that stalls stops here, so the last one still gets a full attempt.
const MODEL_BUDGET_MS = DEADLINE_MS - ATTEMPT_TIMEOUT_MS;

const CAPTION_COUNT = 3;
const CAPTION_MAX_LENGTH = 200;

const SYSTEM_PROMPT = `You write photo captions for a website where college students who are new to New York City post photos from around the city, and everyone votes on the funniest caption.

Rules:
- Write exactly ${CAPTION_COUNT} captions. Each one takes a different angle on what is actually in the photo.
- One line each, under 100 characters. No hashtags, no surrounding quotation marks, at most one emoji.
- Be specific to this photo. Generic captions that could fit any picture lose.
- Be funny and kind: punch up. Never joke about anyone's appearance, race, ethnicity, religion, gender, sexuality or disability.
- If the photo isn't from New York, caption it anyway in the requested voice.`;

export class CaptionError extends Error {}

export type CaptionResult = {
  captions: string[];
  systemPrompt: string;
  prompt: string;
  model: string;
};

function buildPrompt(vibe: Vibe, location: string | null) {
  const where = location
    ? `The poster says it was taken at: "${location}".`
    : "The poster didn't say where in New York it was taken.";
  return `Voice: write as ${VIBES[vibe].instruction}\n${where}\nCaption this photo.`;
}

// Returns the captions plus the exact prompt text and model used, so they can
// be saved alongside the photo.
export async function generateCaptions({
  image,
  mimeType,
  vibe,
  location,
}: {
  image: Buffer;
  mimeType: string;
  vibe: Vibe;
  location: string | null;
}): Promise<CaptionResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new CaptionError("Caption generation isn't set up yet (missing GEMINI_API_KEY).");

  // Always two different models: the first choice, then the next default.
  const models = [
    ...new Set([process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL, DEFAULT_MODEL, FALLBACK_MODEL]),
  ].slice(0, 2);
  const prompt = buildPrompt(vibe, location);
  const ai = new GoogleGenAI({ apiKey });
  const deadline = AbortSignal.timeout(DEADLINE_MS);

  let lastError: unknown;
  for (const [index, model] of models.entries()) {
    if (deadline.aborted) break;
    const isLast = index === models.length - 1;
    const signal = isLast
      ? deadline
      : AbortSignal.any([deadline, AbortSignal.timeout(MODEL_BUDGET_MS)]);
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          { inlineData: { data: image.toString("base64"), mimeType } },
          prompt,
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              captions: {
                type: "array",
                items: { type: "string" },
                minItems: CAPTION_COUNT,
                maxItems: CAPTION_COUNT,
              },
            },
            required: ["captions"],
          },
          // Short captions don't need long reasoning, and users are waiting.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: signal,
          httpOptions: {
            timeout: ATTEMPT_TIMEOUT_MS,
            retryOptions: {
              attempts: ATTEMPTS_PER_MODEL,
              initialDelay: 1,
              maxDelay: 3,
              httpStatusCodes: RETRY_STATUSES,
            },
          },
        },
      });
      text = response.text;
    } catch (error) {
      console.error(`Gemini request to ${model} failed`, error);
      lastError = error;
      if (worthAnotherModel(error)) continue;
      break;
    }

    const captions = parseCaptions(text);
    if (captions.length === 0) {
      throw new CaptionError(
        "Gemini didn't return any captions for that photo. Try a different one.",
      );
    }
    return { captions, systemPrompt: SYSTEM_PROMPT, prompt, model };
  }

  throw new CaptionError(
    isBusy(lastError)
      ? "Gemini is overloaded right now. Wait a minute and try again."
      : "Gemini couldn't caption that photo. Please try again.",
  );
}

// A request that was cut off by our timeout or deadline.
function isTimeout(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function isBusy(error: unknown) {
  return (error instanceof ApiError && RETRY_STATUSES.includes(error.status)) || isTimeout(error);
}

// Node's fetch rejects with TypeError("fetch failed") when the connection is
// reset or can't be opened; the SDK doesn't retry those.
function isConnectionError(error: unknown) {
  return error instanceof TypeError && error.message === "fetch failed";
}

// Any API error can be specific to one model (overloaded, out of quota, not
// available to this key, or not supporting a setting), so the other model
// gets a turn. A bad key fails fast on both.
function worthAnotherModel(error: unknown) {
  return error instanceof ApiError || isTimeout(error) || isConnectionError(error);
}

function parseCaptions(text: string | undefined) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text ?? "");
  } catch {
    return [];
  }

  const list = (parsed as { captions?: unknown })?.captions;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const captions: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const caption = item
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^["“](.*)["”]$/, "$1")
      .slice(0, CAPTION_MAX_LENGTH)
      .trim();
    const key = caption.toLowerCase();
    if (!caption || seen.has(key)) continue;
    seen.add(key);
    captions.push(caption);
  }
  return captions.slice(0, CAPTION_COUNT);
}
