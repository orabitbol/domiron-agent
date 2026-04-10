import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/requests/[id]/generate-variants
 *
 * Creates 2 variant ContentRequests (B and C) from an existing request,
 * and tags the original as variant A with its own instruction block.
 *
 * Each variant carries a full persona directive that overrides the writing
 * mindset — not just the tone, but WHO is writing and WHY.
 *
 * The agent worker picks them up and generates drafts normally.
 * Zero schema changes.
 */

type RouteContext = { params: Promise<{ id: string }> };

// ─── Variant personas ────────────────────────────────────────────────────────
// These are injected as the `instructions` field on each ContentRequest.
// They must be strong enough that Claude produces fundamentally different copy.
// Each one defines a different person with a different worldview.

const VARIANT_A_INSTRUCTION = `
--- הנחיות גרסה [A] — אגרסיבי / הפסד / פחד ---

אתה כותב כמו מישהו שרואה את הקורא מפסיד ברגע הזה ולא יכול לשתוק.
דחוף. מלחיץ. חד.

המיינדסט שלך:
- הקורא כבר מפסיד. עכשיו. בזמן שהוא קורא.
- מישהו תוקף אותו / שודד אותו / עוקף אותו.
- אין זמן. כל שנייה שעוברת — הוא מפסיד יותר.

איך אתה כותב:
- משפטים קצרים. 3–8 מילים.
- פעלים חזקים: תקפו, לקחו, נעלם, נגמר.
- לא מסביר. לא מפרט. מכה.
- שורה ראשונה = מכה ישירה.

דוגמה לטון:
"תקפו אותך."
"הזהב? נגמר."
"ישנת. שילמת."

אל תכתוב כמו B (שקט) או C (אגו). אתה לוחץ. אתה דוחף. אתה מלחיץ.
`.trim();

const VARIANT_B_INSTRUCTION = `
--- הנחיות גרסה [B] — שקט / חכם / שליטה ---

אתה כותב כמו מישהו שיודע הכל ולא מתרגש.
שקט. בטוח. קר.

המיינדסט שלך:
- אתה לא צריך לצעוק. אתה פשוט יודע.
- אתה רואה את מה שקורה ומרים גבה.
- אתה מדבר לקורא כמו מישהו מנוסה שאומר "אתה מבין מה קורה, נכון?"

איך אתה כותב:
- טון נמוך. בלי סימני קריאה. בלי דרמה.
- משפטים שמשאירים מקום. לא אומרים הכל.
- מרמז. לא מכריז.
- הקורא צריך להרגיש שהוא מגלה את זה לבד.

דוגמה לטון:
"הזהב שלך בחוץ."
"מישהו כבר ראה."
"אתה יודע מה קורה כשלא מתחברים."

אל תכתוב כמו A (לוחץ) או C (אגו). אתה שקט. אתה יודע. אתה לא צריך להוכיח.
`.trim();

const VARIANT_C_INSTRUCTION = `
--- הנחיות גרסה [C] — אגו / תחרות / קנאה ---

אתה כותב כמו מישהו שמראה לקורא שאחרים עקפו אותו.
גאוותני. משווה. דוקר.

המיינדסט שלך:
- יש מישהו ספציפי שיותר טוב מהקורא. עכשיו.
- הקורא מאחור. הוא לא יודע כמה.
- אתה לא מרחם. אתה מראה לו את הפער.

איך אתה כותב:
- השוואה ישירה: "הוא כבר שם. אתה לא."
- גוף שלישי לאויב: "הוא", "מישהו", "כולם"
- פגיעה באגו: "חשבת שאתה מוביל?"
- הקורא צריך להרגיש נחיתות, קנאה, רצון להוכיח.

דוגמה לטון:
"כולם כבר בעיר 3. אתה ב-1."
"הוא לא יותר חזק. הוא פשוט לא ישן."
"חשבת שאתה טוב? תבדוק את הדירוג."

אל תכתוב כמו A (לוחץ) או B (שקט). אתה דוקר. אתה משווה. אתה פוגע בגאווה.
`.trim();

const VARIANTS = [
  { label: "B", instruction: VARIANT_B_INSTRUCTION },
  { label: "C", instruction: VARIANT_C_INSTRUCTION },
];

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const original = await prisma.contentRequest.findUnique({ where: { id } });
    if (!original) {
      return NextResponse.json({ error: "בקשה לא נמצאה" }, { status: 404 });
    }

    // Strip any existing variant prefix for the base title
    const baseTitle = original.title.replace(/^\[[A-C]\]\s*/, "");

    // Check if variants already exist
    const existingVariants = await prisma.contentRequest.findMany({
      where: {
        title: { startsWith: `[B] ${baseTitle}` },
      },
      select: { id: true },
    });

    if (existingVariants.length > 0) {
      return NextResponse.json(
        { error: "גרסאות כבר נוצרו לבקשה זו" },
        { status: 409 }
      );
    }

    // Create B and C variant requests
    const created = [];
    for (const variant of VARIANTS) {
      const variantRequest = await prisma.contentRequest.create({
        data: {
          title: `[${variant.label}] ${baseTitle}`,
          platform: original.platform,
          contentType: original.contentType,
          sequenceDay: original.sequenceDay,
          contentPillar: original.contentPillar,
          instructions: variant.instruction,
          targetPublishDate: original.targetPublishDate,
          status: "NEW",
        },
      });
      created.push(variantRequest);
    }

    // Tag and update original as variant A
    await prisma.contentRequest.update({
      where: { id },
      data: {
        title: `[A] ${baseTitle}`,
        instructions: VARIANT_A_INSTRUCTION,
      },
    });

    console.log(
      `[generate-variants] Created variants for "${baseTitle}": ` +
      `A=${id}, B=${created[0].id}, C=${created[1].id}`
    );

    return NextResponse.json({
      data: {
        original: id,
        variants: created.map((c) => ({ id: c.id, title: c.title })),
      },
    });
  } catch (err) {
    console.error("[generate-variants] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
