"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { FileText, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestSchema, type RequestFormData } from "@/lib/validations/request";
import { useCreateRequest } from "@/hooks/use-requests";

const inputStyle = {
  backgroundColor: "#0F1117",
  borderColor: "#2D3148",
  color: "#F1F5F9",
};

const selectStyle = {
  ...inputStyle,
  height: "40px",
  width: "100%",
  borderRadius: "6px",
  border: "1px solid #2D3148",
  padding: "0 12px",
  fontSize: "14px",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  cursor: "pointer",
};

const PLATFORM_OPTIONS = [
  { value: "INSTAGRAM", label: "אינסטגרם" },
  { value: "FACEBOOK", label: "פייסבוק" },
  { value: "BOTH", label: "שניהם" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "POST", label: "פוסט", disabled: false },
  { value: "STORY", label: "סטורי (לא זמין)", disabled: true },
  { value: "CAROUSEL", label: "קרוסלה", disabled: false },
  { value: "REEL", label: "ריל (לא זמין)", disabled: true },
];

// ─── Presets ──────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  icon: typeof FileText;
  title: string;
  subtitle: string;
  hint: string;
  values: Partial<RequestFormData>;
}

const PRESETS: Preset[] = [
  {
    id: "fb-post",
    icon: FileText,
    title: "מסר אחד חד — מכה מהירה",
    subtitle: "פוסט פייסבוק",
    hint: "כשיש לך מסר אחד חזק",
    values: {
      title: "פוסט פייסבוק — מכה מהירה",
      platform: "FACEBOOK" as const,
      contentType: "POST" as const,
      contentPillar: "קרב",
      instructions:
        "פוסט אחד. שורה אחת שעוצרת בגלילה.\n" +
        "הטון: מישהו שרואה את הקורא מפסיד ולא יכול לשתוק.\n" +
        "דחוף. מלחיץ. חד. משפטים של 3–8 מילים.\n" +
        "לא מסביר. לא מפרט. מכה.\n" +
        "דוגמה לטון: \"תקפו אותך.\" / \"הזהב? נגמר.\" / \"ישנת. שילמת.\"\n" +
        "CTA ישיר. תמונה בודדת או טקסט בלבד.",
    },
  },
  {
    id: "fb-carousel",
    icon: Layers,
    title: "רצף שמפיל — הסלמה רגשית",
    subtitle: "קרוסלת פייסבוק",
    hint: "כשאתה רוצה להכניס את הקורא לתהליך",
    values: {
      title: "קרוסלת פייסבוק — הסלמה רגשית",
      platform: "FACEBOOK" as const,
      contentType: "CAROUSEL" as const,
      contentPillar: "תחרות",
      instructions:
        "קרוסלה של 3–5 סליידים. כל סלייד = שורה אחת חדה.\n" +
        "הטון: מישהו שמראה לקורא שאחרים עקפו אותו.\n" +
        "השוואה ישירה. פגיעה באגו. תחושת נחיתות.\n" +
        "\"כולם כבר בעיר 3. אתה ב-1.\"\n" +
        "\"הוא לא יותר חזק. הוא פשוט לא ישן.\"\n" +
        "\"חשבת שאתה טוב? תבדוק את הדירוג.\"\n" +
        "הסלמה: איום → כאב → הסלמה → הבנה → פעולה.\n" +
        "לא מצגת. לא שיעור. רצף מכות שדוקרות באגו.",
    },
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function RequestForm() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateRequest();
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: "",
      contentPillar: "",
      instructions: "",
      targetPublishDate: "",
    },
  });

  const applyPreset = (preset: Preset) => {
    const entries = Object.entries(preset.values) as Array<
      [keyof RequestFormData, string]
    >;
    for (const [key, value] of entries) {
      if (value !== undefined) {
        setValue(key, value, { shouldValidate: true });
      }
    }
    setActivePreset(preset.id);
    toast.success(`הוחל: ${preset.subtitle}`);
  };

  const onSubmit = async (data: RequestFormData) => {
    try {
      await mutateAsync(data);
      toast.success("הבקשה נשמרה בהצלחה");
      router.push("/requests");
    } catch {
      toast.error("שגיאה בשמירת הבקשה");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Presets ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "#64748B" }}
        >
          התחל מתבנית
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-xl border p-4 text-right transition-all duration-200 hover:scale-[1.02]"
                style={{
                  backgroundColor: isActive ? "#1e2030" : "#1A1D27",
                  borderColor: isActive ? "#6B5CF6" : "#2D3148",
                  boxShadow: isActive ? "0 0 20px rgba(107,92,246,0.15)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "#6B5CF680";
                    e.currentTarget.style.backgroundColor = "#1e2030";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "#2D3148";
                    e.currentTarget.style.backgroundColor = "#1A1D27";
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: isActive ? "#6B5CF630" : "#6B5CF615",
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isActive ? "#c4b5fd" : "#a78bfa" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{ color: "#F1F5F9" }}
                    >
                      {preset.title}
                    </p>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: isActive ? "#a78bfa" : "#64748B" }}
                    >
                      {preset.subtitle}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "#475569" }}
                    >
                      {preset.hint}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px]" style={{ color: "#475569" }}>
          לא חייבים לבחור תבנית — אפשר למלא ידנית
        </p>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="h-px" style={{ backgroundColor: "#2D3148" }} />

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>
            כותרת הבקשה <span style={{ color: "#f87171" }}>*</span>
          </Label>
          <Input
            {...register("title")}
            placeholder="לדוגמה: פוסט ל-Black Friday"
            className="border"
            style={inputStyle}
          />
          {errors.title && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>
            פלטפורמה <span style={{ color: "#f87171" }}>*</span>
          </Label>
          <select {...register("platform")} style={selectStyle}>
            <option value="">בחר פלטפורמה</option>
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.platform && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.platform.message ?? "יש לבחור פלטפורמה"}
            </p>
          )}
        </div>

        {/* Content Type */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>
            סוג תוכן <span style={{ color: "#f87171" }}>*</span>
          </Label>
          <select {...register("contentType")} style={selectStyle}>
            <option value="">בחר סוג תוכן</option>
            {CONTENT_TYPE_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                style={opt.disabled ? { color: "#475569" } : undefined}
              >
                {opt.label}
              </option>
            ))}
          </select>
          {errors.contentType && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.contentType.message ?? "יש לבחור סוג תוכן"}
            </p>
          )}
        </div>

        {/* Sequence Day */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>יום בסדרה</Label>
          <Input
            type="number"
            min={1}
            max={365}
            {...register("sequenceDay", {
              setValueAs: (v) =>
                v === "" || v === undefined ? undefined : parseInt(v, 10),
            })}
            placeholder="לדוגמה: 1"
            className="border"
            style={inputStyle}
          />
          {errors.sequenceDay && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.sequenceDay.message}
            </p>
          )}
        </div>

        {/* Content Pillar */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>עמוד תוכן</Label>
          <Input
            {...register("contentPillar")}
            placeholder="לדוגמה: חינוך, השראה, מכירה"
            className="border"
            style={inputStyle}
          />
          {errors.contentPillar && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.contentPillar.message}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>הוראות</Label>
          <textarea
            {...register("instructions")}
            rows={4}
            placeholder="הוסף הוראות או הנחיות לבקשה..."
            className="flex w-full rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none"
            style={{
              ...inputStyle,
              borderColor: "#2D3148",
            }}
          />
          {errors.instructions && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.instructions.message}
            </p>
          )}
        </div>

        {/* Target Publish Date */}
        <div className="space-y-2">
          <Label style={{ color: "#F1F5F9" }}>תאריך פרסום מיועד</Label>
          <Input
            type="date"
            {...register("targetPublishDate", {
              setValueAs: (v) => (v === "" ? undefined : v),
            })}
            className="border"
            style={inputStyle}
            dir="ltr"
          />
          {errors.targetPublishDate && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {errors.targetPublishDate.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={isPending}
            style={{ backgroundColor: "#6B5CF6", color: "#ffffff" }}
          >
            {isPending ? "שומר..." : "שמור בקשה"}
          </Button>
          <Link href="/requests">
            <Button
              type="button"
              variant="outline"
              style={{
                borderColor: "#2D3148",
                color: "#94A3B8",
                backgroundColor: "transparent",
              }}
            >
              ביטול
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
