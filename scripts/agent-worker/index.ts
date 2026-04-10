/**
 * Domiron Agent Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches NEW ContentRequests from the database, generates social media draft
 * content using Claude, and submits each draft to /api/agent/intake.
 *
 * HOW IT AVOIDS DUPLICATES:
 *   1. Only queries rows where status = "NEW" AND no draft exists yet.
 *   2. Immediately marks each row IN_PROGRESS before calling Claude (so a
 *      second concurrent run won't pick it up).
 *   3. The intake endpoint returns 409 if a draft already exists — we skip
 *      gracefully and log a warning rather than crashing.
 *   4. On any error, the row is reset to NEW so it retries next run.
 *
 * RUNNING LOCALLY:
 *   1. Make sure the Next.js dev server is running: npm run dev
 *   2. Copy .env (or .env.local) — ANTHROPIC_API_KEY must be set
 *   3. npm run agent:worker
 *      (or: npx tsx scripts/agent-worker/index.ts)
 *
 * ENV VARS REQUIRED:
 *   DATABASE_URL        — Prisma connection string (same as the dashboard)
 *   AGENT_API_KEY       — Must match what the intake route checks (X-Agent-Key)
 *   ANTHROPIC_API_KEY   — Your Anthropic API key
 *   INTAKE_URL          — (optional) Defaults to http://localhost:3000/api/agent/intake
 *   CLAUDE_MODEL        — (optional) Defaults to claude-sonnet-4-6
 */

// Load .env / .env.local before anything else
import "dotenv/config";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { buildPrompt, type GameContext } from "./prompt";
import type { IntakePayload, DraftContent } from "./schema";

// ─── Config ──────────────────────────────────────────────────────────────────

const INTAKE_URL =
  process.env.INTAKE_URL || "http://localhost:3000/api/agent/intake";
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// Validate required env vars immediately — fail loud, not silent
if (!AGENT_API_KEY) {
  console.error("❌  AGENT_API_KEY is not set. Check your .env file.");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY is not set. Check your .env file.");
  process.exit(1);
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Game context loader ──────────────────────────────────────────────────────
// Loaded once at startup from game-context.json.
// All facts Claude is allowed to cite come from this file.
// If the file is missing or malformed → warn and continue with empty context
// (Claude will write atmospheric content with no factual claims).
// To update game facts: edit game-context.json and re-run the worker.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GAME_CONTEXT_PATH = join(__dirname, "context", "game-context.json");

function loadGameContext(): GameContext {
  try {
    const raw = readFileSync(GAME_CONTEXT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    console.log(`📖  Game context loaded from game-context.json`);
    return { facts: JSON.stringify(parsed, null, 2) };
  } catch {
    throw new Error(
      `[context] Cannot load game context.\n` +
        `Expected: ${GAME_CONTEXT_PATH}\n` +
        `The worker cannot run without this file.`
    );
  }
}

// Loaded once — shared across all requests in a single worker run
const GAME_CONTEXT: GameContext = loadGameContext();

// ─── Step 1: Fetch new requests ───────────────────────────────────────────────

async function fetchNewRequests() {
  return prisma.contentRequest.findMany({
    where: {
      status: "NEW",
      draft: null, // No draft created yet
    },
    orderBy: { createdAt: "asc" }, // Process oldest first
  });
}

// ─── Step 2: Lock the row (prevents concurrent double-processing) ─────────────

async function markInProgress(id: string) {
  await prisma.contentRequest.update({
    where: { id },
    data: { status: "IN_PROGRESS" },
  });
}

// ─── Step 3: Reset on failure ─────────────────────────────────────────────────

async function resetToNew(id: string) {
  await prisma.contentRequest
    .update({ where: { id }, data: { status: "NEW" } })
    .catch((err) =>
      console.warn(`  ⚠️  Could not reset ${id} to NEW: ${err.message}`)
    );
}

// ─── Step 4: Generate draft with Claude ───────────────────────────────────────

/**
 * The Claude tool definition mirrors the intake schema exactly.
 * Using tool_choice: { type: "tool" } forces Claude to always call this tool
 * so we always get structured JSON back — no free-text parsing required.
 */
const SUBMIT_DRAFT_TOOL: Anthropic.Tool = {
  name: "submit_draft",
  description:
    "Submit the generated social media draft content for this request.",
  input_schema: {
    type: "object" as const,
    properties: {
      format: {
        type: "string",
        enum: ["STATIC", "CAROUSEL", "REEL", "STORY"],
        description: "Content format (must match the request content type).",
      },
      hook: {
        type: "string",
        description:
          "Scroll-stopping opening hook — 5 to 200 characters. Required.",
      },
      goal: {
        type: "string",
        description: "What this post aims to achieve for Domiron.",
      },
      best_angle: {
        type: "string",
        description: "The creative angle or perspective being used.",
      },
      facebook_caption: {
        type: "string",
        description: "Full caption for Facebook. Max 2000 chars.",
      },
      instagram_caption: {
        type: "string",
        description: "Full caption for Instagram. Max 2200 chars.",
      },
      story_frames: {
        type: "array",
        description:
          "Required when format is STORY. 3–5 frames in sequence order.",
        items: {
          type: "object",
          properties: {
            order: {
              type: "number",
              description: "Frame position (1-based).",
            },
            text: {
              type: "string",
              description: "Text displayed on this frame.",
            },
            isLogoFrame: {
              type: "boolean",
              description: "True for the final logo/CTA frame.",
            },
          },
          required: ["order", "text"],
        },
      },
      carousel_slides: {
        type: "array",
        description:
          "Required when format is CAROUSEL. 3–7 slides following emotional escalation: threat → pain → escalation → realization → action. Each slide is one short, punchy line. No mechanics explanations.",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "One short, punchy line for this slide. Must be emotionally charged — not explanatory.",
            },
          },
          required: ["text"],
        },
      },
      cta: {
        type: "string",
        description: 'Call-to-action text (e.g. "Follow for launch updates").',
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "5–15 hashtags as plain strings WITHOUT the # symbol.",
      },
      visual_direction: {
        type: "string",
        description:
          "One actionable sentence describing exactly what the designer should create.",
      },
      why_this_matters: {
        type: "string",
        description: "One sentence on the strategic purpose of this post.",
      },
    },
    required: ["format", "hook"],
  },
};

async function generateDraftWithClaude(
  request: {
    id: string;
    title: string;
    platform: "INSTAGRAM" | "FACEBOOK" | "BOTH";
    contentType: "POST" | "STORY" | "CAROUSEL" | "REEL";
    sequenceDay: number | null;
    contentPillar: string | null;
    instructions: string | null;
  },
  context: GameContext
): Promise<DraftContent> {
  const prompt = buildPrompt(request, context);

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    tools: [SUBMIT_DRAFT_TOOL],
    // Force Claude to always call submit_draft — no free-text fallback
    tool_choice: { type: "tool", name: "submit_draft" },
    messages: [{ role: "user", content: prompt }],
  });

  // Find the tool_use block
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude did not return a tool_use block. Stop reason: ${message.stop_reason}`
    );
  }

  return toolUse.input as DraftContent;
}

// ─── Step 5: POST to /api/agent/intake ───────────────────────────────────────

async function postToIntake(
  requestId: string,
  content: DraftContent,
  request: {
    platform: "INSTAGRAM" | "FACEBOOK" | "BOTH";
    contentType: "POST" | "STORY" | "CAROUSEL" | "REEL";
    sequenceDay: number | null;
    contentPillar: string | null;
  }
): Promise<{ skipped: boolean; draftId?: string }> {
  const payload: IntakePayload = {
    request_id: requestId,
    version: 1,
    meta: {
      platform: request.platform,
      content_type: request.contentType,
      ...(request.sequenceDay !== null && {
        sequence_day: request.sequenceDay,
      }),
      ...(request.contentPillar && {
        content_pillar: request.contentPillar.slice(0, 50), // schema max
      }),
    },
    content,
  };

  const res = await fetch(INTAKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Key": AGENT_API_KEY!,
    },
    body: JSON.stringify(payload),
  });

  // 409 = draft already exists — not a crash, just a skip
  if (res.status === 409) {
    return { skipped: true };
  }

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = res.statusText;
    }
    throw new Error(
      `Intake returned ${res.status}: ${JSON.stringify(errorBody)}`
    );
  }

  const data = await res.json();
  return { skipped: false, draftId: data?.data?.id };
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🤖  Domiron Agent Worker");
  console.log(`    Model:      ${CLAUDE_MODEL}`);
  console.log(`    Intake URL: ${INTAKE_URL}`);
  console.log(`    Time:       ${new Date().toISOString()}`);
  console.log("");

  let requests;
  try {
    requests = await fetchNewRequests();
  } catch (err) {
    console.error(
      "❌  Failed to connect to database:",
      (err as Error).message
    );
    console.error(
      "    Make sure DATABASE_URL is set and the DB is reachable."
    );
    process.exit(1);
  }

  if (requests.length === 0) {
    console.log("✅  No new requests found. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  console.log(`📋  Found ${requests.length} new request(s)\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const req of requests) {
    const label = `[${req.id.slice(-8)}] "${req.title}"`;
    console.log(`→  ${label}`);
    console.log(
      `   Platform: ${req.platform} | Type: ${req.contentType}${req.contentPillar ? ` | Pillar: ${req.contentPillar}` : ""}`
    );

    try {
      // Lock the row immediately
      await markInProgress(req.id);

      // Generate with Claude — GAME_CONTEXT is injected into every prompt
      console.log(`   🧠  Calling Claude (${CLAUDE_MODEL})...`);
      const content = await generateDraftWithClaude(
        {
          id: req.id,
          title: req.title,
          platform: req.platform as "INSTAGRAM" | "FACEBOOK" | "BOTH",
          contentType: req.contentType as "POST" | "STORY" | "CAROUSEL" | "REEL",
          sequenceDay: req.sequenceDay,
          contentPillar: req.contentPillar,
          instructions: req.instructions,
        },
        GAME_CONTEXT
      );

      console.log(`   📤  Submitting to intake...`);
      const result = await postToIntake(req.id, content, {
        platform: req.platform as "INSTAGRAM" | "FACEBOOK" | "BOTH",
        contentType: req.contentType as "POST" | "STORY" | "CAROUSEL" | "REEL",
        sequenceDay: req.sequenceDay,
        contentPillar: req.contentPillar,
      });

      if (result.skipped) {
        console.log(
          `   ⚠️   Draft already existed for this request — skipped`
        );
        skipped++;
      } else {
        console.log(`   ✅  Draft created → ${result.draftId}`);
        processed++;
      }
    } catch (err) {
      console.error(`   ❌  Error: ${(err as Error).message}`);
      await resetToNew(req.id);
      failed++;
    }

    console.log("");
  }

  // Summary
  console.log("─".repeat(50));
  console.log(
    `📊  Done — ${processed} created, ${skipped} skipped, ${failed} failed`
  );
  if (failed > 0) {
    console.log(
      `    Failed requests were reset to NEW and will retry next run.`
    );
  }

  await prisma.$disconnect();

  // Exit with non-zero code if any failures so CI/cron can detect problems
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
