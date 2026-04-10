/**
 * Builds the Claude prompt from a ContentRequest row.
 * Keep this file: if the prompt needs tuning, change it here — not in index.ts.
 *
 * SOURCES INJECTED (in order):
 *   1. content-rulebook.md  — loaded from disk once at startup; defines all
 *                             tone, language, and grounding rules
 *   2. game-facts JSON      — passed in as gameContext string; verified facts
 *                             Claude is allowed to cite (empty until provided)
 *   3. Request brief        — the specific ContentRequest fields
 *   4. Field requirements   — per-field output instructions
 *
 * DESIGN PRINCIPLES:
 *   - All consumer-facing copy is in Hebrew (RTL, colloquial Israeli)
 *   - Format selection biases toward CAROUSEL and REEL over STATIC
 *   - Structured JSON output is enforced by tool_choice in index.ts;
 *     this prompt focuses on creative quality and grounding
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ─── Rulebook loader ──────────────────────────────────────────────────────────
// Loaded once when the module is first imported, not on every call.
// If the file is missing, we throw immediately so the worker fails loud
// rather than generating ungrounded content silently.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RULEBOOK_PATH = join(__dirname, "context", "content-rulebook.md");

function loadRulebook(): string {
  try {
    return readFileSync(RULEBOOK_PATH, "utf-8").trim();
  } catch {
    throw new Error(
      `[prompt] Cannot load content rulebook.\n` +
        `Expected: ${RULEBOOK_PATH}\n` +
        `The worker cannot run without this file.`
    );
  }
}

// Load at module init — crash early if the file is missing
const CONTENT_RULEBOOK = loadRulebook();

// ─── Format selection logic ───────────────────────────────────────────────────
// Maps each content type to a ranked list of preferred formats.
// CAROUSEL and REEL are ranked first wherever they apply — they outperform
// STATIC on Facebook reach and engagement for game pre-launch content.

type Platform = "INSTAGRAM" | "FACEBOOK" | "BOTH";
type ContentType = "POST" | "STORY" | "CAROUSEL" | "REEL";

const FORMAT_OPTIONS: Record<ContentType, { preferred: string[]; rule: string }> = {
  POST: {
    preferred: ["CAROUSEL", "STATIC"],
    rule:
      "Use CAROUSEL if there's any opportunity to build emotional escalation across slides. " +
      "Use STATIC only for single-punch posts — one sharp image, one sharp line.",
  },
  REEL: {
    preferred: ["REEL"],
    rule: "Always use REEL. Write the hook and caption for short-form vertical video.",
  },
  CAROUSEL: {
    preferred: ["CAROUSEL"],
    rule:
      "Always use CAROUSEL. Structure as emotional escalation: threat → pain → escalation → realization → action. " +
      "Each slide must hit harder than the last. This is NOT an educational slideshow — it's a pressure sequence.",
  },
  STORY: {
    preferred: ["STORY"],
    rule:
      "Always use STORY. Write 3–5 frames. Final frame is always the logo/CTA frame (isLogoFrame: true).",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestInput {
  title: string;
  platform: Platform;
  contentType: ContentType;
  sequenceDay: number | null;
  contentPillar: string | null;
  instructions: string | null;
}

/**
 * Verified game context fetched from /api/agent/context before calling Claude.
 * All fields are optional — the prompt handles missing sections gracefully
 * by instructing Claude to omit rather than invent.
 */
export interface GameContext {
  /** Raw game-facts JSON string (from game-facts.json or future DB endpoint) */
  facts?: string;
  /** Approved media assets available to reference */
  media?: Array<{
    url: string;
    visual_description?: string;
    format?: string;
  }>;
  /** Recent approved hooks — Claude must not repeat these */
  post_history?: Array<{
    hook: string;
    content_pillar?: string;
  }>;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Assembles the full Claude prompt from:
 *   - The content rulebook (loaded from disk)
 *   - The verified game context (facts + media + history)
 *   - The specific content request brief
 *   - Per-field output requirements
 *
 * @param request  The ContentRequest row from the database
 * @param context  Verified game context fetched before this call (optional)
 */
export function buildPrompt(request: RequestInput, context?: GameContext): string {
  const fmt = FORMAT_OPTIONS[request.contentType];
  const sections: string[] = [];

  // ── SECTION 1: RULEBOOK ───────────────────────────────────────────────────
  // The rulebook is the first thing Claude reads. It defines what is allowed,
  // what is forbidden, and what constitutes a valid post. Everything else
  // in this prompt operates within the boundaries the rulebook sets.
  sections.push(`\
# חוקי תוכן — קרא לפני הכל

${CONTENT_RULEBOOK}`);

  // ── SECTION 2: GAME CONTEXT (verified facts only) ─────────────────────────
  // Claude may ONLY cite facts that appear in this block.
  // If this block is empty → write atmospheric content with no factual claims.
  const contextLines: string[] = [
    ``,
    `---`,
    ``,
    `# הקשר מאומת — אלה העובדות היחידות שמותר לך לצטט`,
    ``,
    `> חשוב: אם נתון לא מופיע כאן — אל תמציא אותו. כתוב בלי אותו.`,
  ];

  const hasFacts = context?.facts && context.facts.trim().length > 0;
  const hasMedia = context?.media && context.media.length > 0;
  const hasHistory = context?.post_history && context.post_history.length > 0;

  if (hasFacts) {
    contextLines.push(``, `## עובדות המשחק`, "```json", context!.facts!, "```");
  } else {
    contextLines.push(
      ``,
      `## עובדות המשחק`,
      `_אין עובדות מאומתות עדיין. אל תמציא מספרים, מכניקות, או תכונות._`
    );
  }

  if (hasMedia) {
    contextLines.push(``, `## נכסי מדיה מאושרים (ניתן להפנות אליהם)`);
    context!.media!.forEach((m, i) => {
      contextLines.push(
        `${i + 1}. פורמט: ${m.format ?? "לא ידוע"} | ${m.visual_description ?? "אין תיאור"}`
      );
    });
  } else {
    contextLines.push(
      ``,
      `## נכסי מדיה מאושרים`,
      `_אין נכסים זמינים. השאר את visual_direction כהנחיה למעצב בלבד._`
    );
  }

  if (hasHistory) {
    contextLines.push(
      ``,
      `## הוקים שכבר פורסמו — אל תחזור עליהם`,
      ...context!.post_history!.map((h) => `- "${h.hook}"`)
    );
  }

  sections.push(contextLines.join("\n"));

  // ── SECTION 3: BRIEF ──────────────────────────────────────────────────────
  const briefLines = [
    ``,
    `---`,
    ``,
    `# בריף`,
    ``,
    `כותרת הבקשה: ${request.title}`,
    `פלטפורמה: ${
      request.platform === "BOTH"
        ? "פייסבוק ואינסטגרם"
        : request.platform === "FACEBOOK"
          ? "פייסבוק"
          : "אינסטגרם"
    }`,
    `סוג תוכן: ${request.contentType}`,
    `פורמט מועדף: ${fmt.preferred.join(" או ")}`,
    `כלל בחירת פורמט: ${fmt.rule}`,
  ];

  if (request.sequenceDay !== null) {
    briefLines.push(`יום בקמפיין: יום ${request.sequenceDay}`);
  }
  if (request.contentPillar) {
    briefLines.push(`זווית תוכן: ${request.contentPillar}`);
  }
  if (request.instructions) {
    briefLines.push(``, `הנחיות נוספות מהצוות:`, request.instructions);
  }

  sections.push(briefLines.join("\n"));

  // ── SECTION 4: FIELD REQUIREMENTS ────────────────────────────────────────
  sections.push(`\

---

# דרישות שדות — מלא את כולם

## hook (חובה — 5 עד 200 תווים)
שורה אחת. זה מה שרואים לפני ה"קרא עוד".
חייב להכות מיד — הפסד, איום, פגיעה באגו, או FOMO.
אפס אמוג׳י. אפס משפטים נחמדים. אפס הסברים.
לא פותחים במספר. לא פותחים במכניקה. פותחים ברגש.

דוגמאות לאיכות הנדרשת:
  - "הזהב שלך חשוף."
  - "ישנת — ושילמת על זה."
  - "הוא תקף אותך בלילה."
  - "כולם כבר בעיר 3. אתה עדיין ב-1."
  - "מישהו ראה בדיוק כמה זהב יש לך."

כתוב הוק שגורם לשחקן להרגיש שהוא מפסיד עכשיו — בלי שום הקשר נוסף.

## facebook_caption (חובה — עד 2,000 תווים)
כתוב כאילו אתה שולח הודעה לחבר שמפסיד ולא יודע.
שורה ראשונה — מעמיקה את הפגיעה שההוק התחיל.
2–4 שורות — כל שורה מוסיפה עוד שכבה של לחץ. קצרות. חדות. כל אחת עומדת לבד.
שורה אחרונה — הקורא חייב להרגיש "עכשיו" — לא "מעניין".
רווח + CTA כפקודה.

אפס פסקאות. אפס רשימות. אפס הסברים.
אם משפט נשמע כמו שורה מ-FAQ — מחק אותו.
אם משפט מתאים לכל משחק בעולם — מחק אותו.
כל מספר חייב להגיע מ"עובדות המשחק" ולהגיע אחרי הכאב, לא לפניו.

## cta (חובה)
פקודה קצרה, גוף שני: "עקבו לעדכון ראשון", "שמרו את התאריך", "שלחו לאחד שחושב שהוא טוב".

## format (חובה)
STATIC / CAROUSEL / REEL / STORY — לפי כלל בחירת הפורמט בבריף.
העדף CAROUSEL ו-REEL בכל פעם שיש יותר מרעיון אחד.

## visual_direction (חובה)
הנחיה למעצב שגורמת לו ליצור ויזואל שמרגיש כמו עולם דומירון.

כללים:
- תמיד כהה: שחור, אפור-כחול, אדום עמוק. לא בהיר. לא שמח.
- תמיד מלחמתי / אסטרטגי / מאיים — לא גנרי, לא קריקטורי, לא "גיימינג" ניאוני
- אלמנטים מעולם דומירון: צבאות, זהב, מבצרים, מרגלים, מפות, ערים, שבטים, אש, חורבן
- כל אלמנט ויזואלי חייב לשרת את המסר — לא "יפה" בשביל יפה
- התאמה לזווית: קרב → חיילים/אש/חומות, כלכלה → זהב/מכרות/כספת, תחרות → כתר/דירוגים/דגלים, ריגול → צללים/מסכות/מודיעין

דוגמה: "רקע כהה, מפה אסטרטגית מוארת בזהב חלקי, צללית של צבא מתקדם לעבר מבצר בוער, טקסט בלבן עם shadow חד, אווירה של רגע לפני תקיפה."

## hashtags (חובה — 5 עד 15)
ללא #. תערובת עברית + אנגלית: שם המשחק, ז'אנר, קהל.

## cited_facts (חובה)
רשימת כל עובדה מ"עובדות המשחק" שהשתמשת בה.
אם הכיתוב מכיל מספרים או עובדות שאינן בהקשר → כתוב מחדש בלי אותן.
אם אין עובדות זמינות → השאר רשימה ריקה [].

## goal (מומלץ)
קטגוריה אחת: מודעות / ויראליות / engagement / רשימת המתנה.

## best_angle (מומלץ)
משפט אחד — הזווית היצירתית שבחרת ולמה.

## why_this_matters (מומלץ)
משפט אחד — המשמעות האסטרטגית של הפוסט בקמפיין.

## instagram_caption (מומלץ אם פלטפורמה כוללת אינסטגרם)
אותה אווירה, פחות מילים. שורות קצרות עם רווחים. עד 2,200 תווים.

## carousel_slides (חובה אם format=CAROUSEL)
3–7 סליידים. כל סלייד = שורה אחת קצרה וחדה.
אסור: הסברי מכניקה, משפטים ארוכים, תיאורי פיצ'ר.
חובה: כל סלייד חייב להיות רגשי — איום, כאב, הסלמה, הבנה, או פקודה לפעולה.

מבנה ההסלמה הרגשית:
  - סלייד 1 → איום: מכה ראשונה, בלי אזהרה. "מישהו ראה את המשאבים שלך."
  - סלייד 2 → כאב: מה בדיוק קורה. "כל 30 דקות הוא מקבל תורות. אתה לא."
  - סלייד 3 → הסלמה: זה יותר גרוע ממה שחשבת. "הוא גם לקח חיילים. 50% עובדים בשבילו."
  - סלייד 4 → הבנה: מה היית צריך לעשות. "הזהב היה צריך להיות בבנק. 100% מוגן."
  - סלייד 5 → פעולה: CTA חד. "תתחבר. תגן על מה שלך. עכשיו."

אם carousel_slides חסר כאשר format=CAROUSEL — הפוסט פסול.
אם הסליידים לא בונים מתח עולה — כתוב מחדש.
אם סלייד כלשהו מסביר מכניקה בלי רגש — כתוב מחדש.

## story_frames (חובה אם format=STORY)
3–5 פריימים. הפריים האחרון תמיד isLogoFrame: true.

---

# הוראת ביצוע

קרא את הרולבוק. קרא את ההקשר המאומת. קרא את הבריף.

אתה לא כותב תוכן. אתה כותב הודעה שגורמת לבן אדם להרגיש שהוא מפסיד.
תחשוב על שחקן שגולל בפיד, רואה את מה שכתבת, ועוצר. זה הסטנדרט.
כתוב כמו שאתה היית שולח הודעה לחבר שלך — קצר, חד, ישיר.
אם משפט נשמע כאילו בוט כתב אותו — תמחק ותכתוב מחדש.
אם משפט מתאים לכל משחק בעולם — תמחק ותכתוב מחדש.
אם הקורא לא ירגיש שום דבר — תמחק ותכתוב מחדש.
אל תסביר. אל תלמד. אל תשווק. תגרום לו להרגיש.

השתמש בכלי submit_draft להחזרת התוצאה. אין טקסט חופשי מחוץ לכלי.`);

  return sections.join("\n");
}
