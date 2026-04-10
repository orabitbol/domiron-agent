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

// ─── Preset types ────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  icon: typeof FileText;
  title: string;
  hint: string;
  values: Partial<RequestFormData>;
}

interface PresetCategory {
  label: string;
  presets: Preset[];
}

// ─── Presets data ────────────────────────────────────────────────────────────

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    label: "קרב",
    presets: [
      {
        id: "battle-attack",
        icon: FileText,
        title: "תקפו אותך",
        hint: "מכה אחת — מישהו תקף",
        values: {
          title: "תקפו אותך",
          platform: "FACEBOOK" as const,
          contentType: "POST" as const,
          contentPillar: "קרב",
          instructions: "\"תקפו אותך.\"\n\"בלילה.\"\nמקסימום 3 שורות, 4 מילים כל אחת.",
        },
      },
      {
        id: "battle-loss",
        icon: FileText,
        title: "ישנת",
        hint: "הפסד — לא ידעת",
        values: {
          title: "ישנת",
          platform: "FACEBOOK" as const,
          contentType: "POST" as const,
          contentPillar: "קרב",
          instructions: "\"ישנת.\"\n\"שילמת.\"\nמקסימום 2 שורות.",
        },
      },
    ],
  },
  {
    label: "כלכלה",
    presets: [
      {
        id: "economy-gold",
        icon: Layers,
        title: "זהב בחוץ",
        hint: "קרוסלה — מישהו ראה ולקח",
        values: {
          title: "זהב בחוץ",
          platform: "FACEBOOK" as const,
          contentType: "CAROUSEL" as const,
          contentPillar: "כלכלה",
          instructions: "\"זהב בחוץ.\" → \"מישהו ראה.\" → \"לקחו.\" → \"תפקיד בבנק.\"\n1–4 מילים לסלייד.",
        },
      },
      {
        id: "economy-stolen",
        icon: FileText,
        title: "לקחו לך",
        hint: "פוסט — הפסד כלכלי",
        values: {
          title: "לקחו לך",
          platform: "FACEBOOK" as const,
          contentType: "POST" as const,
          contentPillar: "כלכלה",
          instructions: "\"לקחו לך.\"\n\"12% כל סיבוב.\"\nמקסימום 2 שורות.",
        },
      },
    ],
  },
  {
    label: "ריגול",
    presets: [
      {
        id: "spy-exposed",
        icon: FileText,
        title: "מישהו ראה",
        hint: "פוסט — חשיפה, פרנויה",
        values: {
          title: "מישהו ראה",
          platform: "FACEBOOK" as const,
          contentType: "POST" as const,
          contentPillar: "ריגול",
          instructions: "\"הוא יודע הכל.\"\n\"אתה? כלום.\"\nמקסימום 2 שורות.",
        },
      },
    ],
  },
  {
    label: "תחרות",
    presets: [
      {
        id: "compete-ahead",
        icon: Layers,
        title: "כולם שם",
        hint: "קרוסלה — כולם לפניך",
        values: {
          title: "כולם שם",
          platform: "FACEBOOK" as const,
          contentType: "CAROUSEL" as const,
          contentPillar: "תחרות",
          instructions: "\"כולם בעיר 3.\" → \"אתה ב-1.\" → \"הפער גדל.\" → \"תתחבר.\"\n1–4 מילים לסלייד.",
        },
      },
      {
        id: "compete-behind",
        icon: FileText,
        title: "אתה מאחור",
        hint: "פוסט — הדירוג השתנה",
        values: {
          title: "אתה מאחור",
          platform: "FACEBOOK" as const,
          contentType: "POST" as const,
          contentPillar: "תחרות",
          instructions: "\"הדירוג השתנה.\"\n\"אתה לא שם.\"\nמקסימום 2 שורות.",
        },
      },
    ],
  },
  {
    label: "שבט",
    presets: [
      {
        id: "tribe-alone",
        icon: FileText,
        title: "לבד אתה נופל",
        hint: "פוסט — אתה לבד, הם מאוחדים",
        values: {
          title: "לבד אתה נופל",
          platform: "FACEBOOK" as const,
          contentType: "POST" as const,
          contentPillar: "שבט",
          instructions: "\"הם מאוחדים.\"\n\"אתה לבד.\"\nמקסימום 2 שורות.",
        },
      },
    ],
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
    toast.success(`הוחל: ${preset.title}`);
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
      <div className="space-y-4">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "#64748B" }}
        >
          התחל מתבנית
        </p>

        {PRESET_CATEGORIES.map((cat) => (
          <div key={cat.label} className="space-y-2">
            <p
              className="text-[11px] font-bold uppercase tracking-wider pr-1"
              style={{ color: "#475569" }}
            >
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {cat.presets.map((preset) => {
                const Icon = preset.icon;
                const isActive = activePreset === preset.id;
                const isCarousel = preset.values.contentType === "CAROUSEL";
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-lg border p-3 text-right transition-all duration-150 hover:scale-[1.01]"
                    style={{
                      backgroundColor: isActive ? "#1e2030" : "#1A1D27",
                      borderColor: isActive ? "#6B5CF6" : "#2D3148",
                      boxShadow: isActive ? "0 0 16px rgba(107,92,246,0.12)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = "#6B5CF660";
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
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: isActive ? "#6B5CF625" : "#6B5CF610",
                        }}
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: isActive ? "#c4b5fd" : "#8b83b8" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-sm font-semibold leading-tight"
                            style={{ color: "#F1F5F9" }}
                          >
                            {preset.title}
                          </p>
                          {isCarousel && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "#6B5CF615", color: "#8b83b8" }}
                            >
                              קרוסלה
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[10px] mt-0.5 leading-snug"
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
          </div>
        ))}

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
