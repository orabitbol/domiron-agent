"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
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
  { value: "POST", label: "פוסט" },
  { value: "STORY", label: "סטורי" },
  { value: "CAROUSEL", label: "קרוסלה" },
  { value: "REEL", label: "ריל" },
];

export function RequestForm() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateRequest();

  const {
    register,
    handleSubmit,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
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
            <option key={opt.value} value={opt.value}>
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
  );
}
