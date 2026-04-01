"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatchDraft } from "@/hooks/use-drafts";

interface MediaUploadSectionProps {
  draftId: string;
  currentMediaUrl: string | null;
}

export function MediaUploadSection({ draftId, currentMediaUrl }: MediaUploadSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentMediaUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: patchDraft, isPending: isSaving } = usePatchDraft();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Step 1: Upload to Cloudinary via our API
      const form = new FormData();
      form.append("file", file);

      console.log(`[MediaUploadSection] Uploading file: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type})`);

      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        body: form,
      });

      const uploadData = await uploadRes.json() as Record<string, unknown>;

      if (!uploadRes.ok) {
        throw new Error((uploadData.error as string | undefined) ?? "שגיאה בהעלאת הקובץ");
      }

      const url = uploadData.url as string;
      if (!url) {
        throw new Error("ה-API לא החזיר כתובת URL לתמונה");
      }

      console.log(`[MediaUploadSection] Upload success: ${url}`);

      // Step 2: Save the URL to the draft via PATCH
      await patchDraft({ id: draftId, data: { mediaUrl: url } });

      setPreviewUrl(url);
      toast.success("התמונה הועלתה ונשמרה בהצלחה");
    } catch (err) {
      console.error("[MediaUploadSection] Upload/save failed:", err);
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת התמונה");
    } finally {
      setIsUploading(false);
      // Always reset input so re-selecting the same file triggers onChange
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      await patchDraft({ id: draftId, data: { mediaUrl: null } });
      setPreviewUrl(null);
      toast.success("התמונה הוסרה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהסרת התמונה");
    }
  };

  const isWorking = isUploading || isSaving;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "#64748B" }}
      >
        תמונה/מדיה
      </p>

      {previewUrl ? (
        <div className="space-y-3">
          {/* Preview */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: "#0F1117" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Draft media preview"
              className="w-full max-h-48 object-cover"
            />
          </div>

          {/* URL display */}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs truncate"
            style={{ color: "#60a5fa" }}
            title={previewUrl}
          >
            {previewUrl}
          </a>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isWorking}
              className="flex-1 gap-2 text-xs font-medium"
              style={{ backgroundColor: "#1e3a5f", color: "#60a5fa" }}
            >
              {isWorking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              החלף תמונה
            </Button>
            <Button
              size="sm"
              onClick={handleRemove}
              disabled={isWorking}
              style={{ backgroundColor: "#450a0a", color: "#f87171" }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isWorking}
          className="w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors"
          style={{ borderColor: "#2D3148", color: "#64748B" }}
        >
          {isWorking ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <ImageIcon className="w-8 h-8" />
          )}
          <span className="text-sm">
            {isWorking ? "מעלה..." : "לחץ להעלאת תמונה"}
          </span>
          <span className="text-xs">JPG, PNG, WebP, GIF — עד 10MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        disabled={isWorking}
      />

      <p className="text-xs" style={{ color: "#475569" }}>
        נדרש לפרסום לאינסטגרם
      </p>
    </div>
  );
}
