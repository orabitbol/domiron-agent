"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RevisionNotesInputProps {
  onSubmit: (note: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  required?: boolean;
  submitLabel?: string;
  placeholder?: string;
}

export function RevisionNotesInput({
  onSubmit,
  onCancel,
  isLoading,
  required = true,
  submitLabel = "שלח",
  placeholder = "הוסף הערה...",
}: RevisionNotesInputProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (required && note.trim().length < 10) {
      setError("ההערה חייבת להכיל לפחות 10 תווים");
      return;
    }
    setError(null);
    onSubmit(note.trim());
  };

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          if (error) setError(null);
        }}
        rows={3}
        placeholder={placeholder}
        className="flex w-full rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none"
        style={{
          backgroundColor: "#0F1117",
          borderColor: error ? "#f87171" : "#2D3148",
          color: "#F1F5F9",
        }}
      />
      {error && (
        <p className="text-xs" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isLoading}
          style={{ backgroundColor: "#6B5CF6", color: "#ffffff" }}
        >
          {isLoading ? "שולח..." : submitLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            borderColor: "#2D3148",
            color: "#94A3B8",
            backgroundColor: "transparent",
          }}
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}
