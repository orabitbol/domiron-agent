/**
 * Builds the Claude prompt from a ContentRequest row.
 * Keep this file: if the prompt needs tuning, change it here — not in index.ts.
 *
 * DESIGN PRINCIPLES:
 * - All consumer-facing copy is in Hebrew (RTL, colloquial Israeli)
 * - Format selection biases toward CAROUSEL and REEL over STATIC
 * - Tone: tension, power, competitive urgency — no generic marketing language
 * - Structured JSON output is enforced by tool_choice in index.ts;
 *   this prompt focuses on creative quality, not output format mechanics
 */

type Platform = "INSTAGRAM" | "FACEBOOK" | "BOTH";
type ContentType = "POST" | "STORY" | "CAROUSEL" | "REEL";

// ─── Format selection logic ───────────────────────────────────────────────────
// Maps each content type to a ranked list of preferred formats.
// The prompt instructs Claude to pick from this list based on the brief.
// CAROUSEL and REEL are ranked first wherever they apply — they outperform
// STATIC on Facebook reach and engagement for game pre-launch content.
const FORMAT_OPTIONS: Record<ContentType, { preferred: string[]; rule: string }> = {
  POST: {
    preferred: ["CAROUSEL", "STATIC"],
    rule:
      "Use CAROUSEL if the brief has more than one angle, feature, or comparison to show. " +
      "Use STATIC only for single-image announcements, quote cards, or countdown visuals.",
  },
  REEL: {
    preferred: ["REEL"],
    rule: "Always use REEL. Write the hook and caption for short-form vertical video.",
  },
  CAROUSEL: {
    preferred: ["CAROUSEL"],
    rule: "Always use CAROUSEL. Plan the slides so each one escalates tension or reveals new information.",
  },
  STORY: {
    preferred: ["STORY"],
    rule: "Always use STORY. Write 3–5 frames. Final frame is always the logo/CTA frame (isLogoFrame: true).",
  },
};

export interface RequestInput {
  title: string;
  platform: Platform;
  contentType: ContentType;
  sequenceDay: number | null;
  contentPillar: string | null;
  instructions: string | null;
}

export function buildPrompt(request: RequestInput): string {
  const fmt = FORMAT_OPTIONS[request.contentType];

  const sections: string[] = [];

  // ── ROLE ─────────────────────────────────────────────────────────────────
  sections.push(`\
אתה מנהל השיווק הראשי של Domiron — משחק אסטרטגיה בדפדפן שנמצא לפני לאנצ׳.
המשימה שלך: לייצר תוכן שמגרה, מכניס לאווירה, ובונה ציפייה. לא מוכרים. מסעירים.

אתה כותב עברית שוטפת, ישירה וחזקה. אין כאן ניסוחים תאגידיים. אין ביטויים שחוקים.
הקהל: גיימרים ישראלים שמכירים ז'אנר האסטרטגיה — Clash, Rise of Kingdoms, Total War.
הם מגיבים לשפה של כוח, שליטה, תחרות, ומחיר הכישלון.`);

  // ── BRIEF ────────────────────────────────────────────────────────────────
  const briefLines = [
    ``,
    `## בריף`,
    `כותרת הבקשה: ${request.title}`,
    `פלטפורמה: ${request.platform === "BOTH" ? "פייסבוק ואינסטגרם" : request.platform === "FACEBOOK" ? "פייסבוק" : "אינסטגרם"}`,
    `סוג תוכן: ${request.contentType}`,
    `פורמט מועדף: ${fmt.preferred.join(" או ")}`,
    `כלל בחירת פורמט: ${fmt.rule}`,
  ];

  if (request.sequenceDay !== null) {
    briefLines.push(`יום בקמפיין: יום ${request.sequenceDay}`);
  }
  if (request.contentPillar) {
    briefLines.push(`עמוד תוכן: ${request.contentPillar}`);
  }
  if (request.instructions) {
    briefLines.push(``, `הנחיות ספציפיות מהצוות:`, request.instructions);
  }

  sections.push(briefLines.join("\n"));

  // ── TONE & LANGUAGE RULES ────────────────────────────────────────────────
  sections.push(`\

## כללי שפה ואווירה

✅ השתמש ב:
- פעלים חזקים: שלוט, כבוש, בנה, השמד, הגן, חדור, שרוד
- מתח ולחץ: "רק אחד יישאר", "הזמן אוזל", "לא כולם מוכנים לזה"
- כינויים ישירים לשחקן: "אתה", "האימפריה שלך", "הצבא שלך"
- ניגודים חדים: "בנה שנים. הרס שניות."
- שאלות שפותחות מתח: "כמה זמן תשרוד?", "את מי אתה סומך?"
- מספרים ועובדות קונקרטיות כשרלוונטיים

❌ אסור:
- "בואו לשחק" / "הצטרף אלינו" / "חוויה חדשה ומרגשת"
- "אנחנו שמחים להודיע" / "גאים להציג"
- "המשחק כבר כאן" (קלישאה)
- תרגום ישיר של ביטויי שיווק באנגלית
- הבטחות עמומות בלי עוקץ
- יותר מ-3 אמוג׳י בכיתוב אחד (אפס בהוק)`);

  // ── FIELD REQUIREMENTS ───────────────────────────────────────────────────
  sections.push(`\

## דרישות לכל שדה — מלא את כולם

### hook (חובה — 5 עד 200 תווים)
שורה אחת. זה מה שרואים לפני ה"קרא עוד".
חייב לגרום לעצירה בגלילה. לא שאלה רטורית חלשה — משפט שנוי.
דוגמאות לאיכות שאנחנו מחפשים:
  - "השאלה היא לא אם תנצח. השאלה היא כמה מהר."
  - "בניתם אימפריות? טוב. עכשיו תגנו עליהן."
  - "כאן לא שורדים במקרה."
כתוב הוק שיכול לעמוד לבד, ללא הקשר.

### facebook_caption (חובה — עד 2,000 תווים)
כיתוב מלא לפייסבוק. מבנה:
1. שורת פתיחה שמחזקת את ההוק (לא חוזרת עליו מילה במילה)
2. 2–4 שורות שבונות את הרעיון — מתח, פרטים, אווירה
3. שורת סיום שפותחת שאלה, נותנת הרגשה של "אני חייב לדעת יותר"
4. רווח + CTA

כתוב בעברית. שורות קצרות. לא רשימות מנוקדות — פרוזה קצבית.

### cta (חובה)
קצר, ישיר, בגוף שני: "עקבו לעדכון ראשון", "שמרו את התאריך", "שלחו לאחד שחושב שהוא טוב".
ה-CTA צריך להרגיש כמו פקודה, לא בקשה.

### format (חובה)
בחר מתוך: STATIC, CAROUSEL, REEL, STORY — לפי כלל בחירת הפורמט בבריף.
העדף CAROUSEL ו-REEL על STATIC בכל פעם שיש יותר מרעיון אחד להראות.

### visual_direction (חובה)
הנחיה ספציפית למעצב — מה בדיוק ליצור.
כלול: סגנון (אנימציה / צילום / CGI / גרפיקה), פלטת צבעים, מה מופיע במרכז, אווירה.
דוגמה לאיכות נכונה: "גרפיקה כהה עם גוון כחול-אפור קר, מבט-על על מפה אסטרטגית, יחידות צבאיות זזות לעמדה, טקסט ה-hook מוגדל בלבן עם shadow חד — אין אלמנטים עליזים."

### hashtags (חובה — 5 עד 15)
ללא סימן #. תערובת של: שם המשחק, ז'אנר, קהל, עברית ואנגלית.
דוגמה: ["דומירון", "משחקיאסטרטגיה", "Domiron", "StrategyGame", "גיימינגישראל"]

### goal (מומלץ)
מה הפוסט הזה אמור להשיג — בקטגוריה אחת: מודעות / ויראליות / ביקוש לרשימת המתנה / engagement.

### best_angle (מומלץ)
הזווית היצירתית שבחרת — משפט אחד. למה הגישה הזו ולא אחרת?

### why_this_matters (מומלץ)
שורה אחת על המשמעות האסטרטגית של הפוסט הזה בקמפיין הכולל.

### instagram_caption (מומלץ אם הפלטפורמה כוללת אינסטגרם)
גרסה קצרה יותר של הכיתוב לאינסטגרם — אותה אווירה, פחות מילים.
שורות קצרות עם רווחים בין בלוקים. עד 2,200 תווים.

### story_frames (חובה אם format=STORY)
מערך של 3–5 פריימים. הפריים האחרון תמיד isLogoFrame: true.`);

  // ── FINAL INSTRUCTION ────────────────────────────────────────────────────
  sections.push(`\

## הוראת ביצוע

קרא את הבריף. בחר פורמט. כתוב תוכן שמרגיש כמו שיווק של אסטרטגיה — לא כמו אפליקציה.
אל תכתוב מה שנשמע "בטוח". כתוב מה שגורם לאנשים לשתף.
השתמש בכלי submit_draft כדי להחזיר את התוצאה. אל תוסיף טקסט חופשי מחוץ לכלי.`);

  return sections.join("\n");
}
