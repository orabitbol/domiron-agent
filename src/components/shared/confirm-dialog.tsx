"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  onConfirm,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          backgroundColor: "#1A1D27",
          borderColor: "#2D3148",
          color: "#F1F5F9",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#F1F5F9" }}>{title}</DialogTitle>
          {description && (
            <DialogDescription style={{ color: "#94A3B8" }}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            style={{
              borderColor: "#2D3148",
              color: "#94A3B8",
              backgroundColor: "transparent",
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            style={
              variant === "destructive"
                ? { backgroundColor: "#ef4444", color: "#ffffff" }
                : { backgroundColor: "#6B5CF6", color: "#ffffff" }
            }
          >
            {isLoading ? "טוען..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
