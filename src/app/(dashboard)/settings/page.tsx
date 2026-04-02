"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Facebook, Instagram, Link2Off, Loader2, AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useMetaConnections,
  useDisconnectMeta,
  type MetaConnectionSafe,
} from "@/hooks/use-meta-connections";

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysUntilExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const days = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "פג תוקף";
  return `${days} ימים`;
}

// ─── ConnectButton ────────────────────────────────────────────────────────────

function ConnectButton({ label }: { label: string }) {
  return (
    <Button
      size="sm"
      className="gap-2"
      style={{ backgroundColor: "#6B5CF6", color: "#ffffff" }}
      onClick={() => { window.location.href = "/api/meta/auth-url"; }}
    >
      <Link2 className="w-4 h-4" />
      {label}
    </Button>
  );
}

// ─── PlatformCard ─────────────────────────────────────────────────────────────

interface PlatformCardProps {
  platform: "FACEBOOK" | "INSTAGRAM";
  connection: MetaConnectionSafe | undefined;
  onDisconnect: (id: string) => void;
  isDisconnecting: boolean;
}

const platformConfig = {
  FACEBOOK: {
    label: "פייסבוק",
    connectLabel: "התחבר עם פייסבוק / אינסטגרם",
    icon: Facebook,
    iconColor: "#4267B2",
    iconBg: "#1e2a3f",
  },
  INSTAGRAM: {
    label: "אינסטגרם",
    connectLabel: "התחבר עם פייסבוק / אינסטגרם",
    icon: Instagram,
    iconColor: "#E1306C",
    iconBg: "#2a1e25",
  },
};

function PlatformCard({
  platform,
  connection,
  onDisconnect,
  isDisconnecting,
}: PlatformCardProps) {
  const { label, connectLabel, icon: Icon, iconColor, iconBg } =
    platformConfig[platform];
  const expiry = connection ? daysUntilExpiry(connection.tokenExpiresAt) : null;
  const isExpired = expiry === "פג תוקף";

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <span
          className="font-semibold text-sm"
          style={{ color: "#F1F5F9" }}
        >
          {label}
        </span>
      </div>

      {connection ? (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "#F1F5F9" }}
            >
              {connection.pageName}
            </p>
            {expiry && (
              <p
                className="text-xs mt-0.5"
                style={{ color: isExpired ? "#f87171" : "#64748B" }}
              >
                {isExpired ? "הטוקן פג תוקף" : `תוקף בעוד ${expiry}`}
              </p>
            )}
            {!expiry && (
              <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                מחובר
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDisconnect(connection.id)}
            disabled={isDisconnecting}
            className="flex-shrink-0 gap-2"
            style={{
              borderColor: "#2D3148",
              color: "#94A3B8",
              backgroundColor: "transparent",
            }}
          >
            {isDisconnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2Off className="w-3.5 h-3.5" />
            )}
            נתק
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm" style={{ color: "#64748B" }}>
            לא מחובר
          </p>
          <ConnectButton label={connectLabel} />
        </div>
      )}
    </div>
  );
}

// ─── OAuth feedback (must be in its own component for Suspense boundary) ──────

function OAuthFeedback() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("meta_connected");
    const error = searchParams.get("meta_error");
    if (connected === "true") {
      toast.success("החיבור ל-Meta הצליח");
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied: "ההרשאה נדחתה על ידי המשתמש",
        token_exchange_failed: "שגיאה בהחלפת טוקן — נסה שוב",
        pages_fetch_failed: "שגיאה בטעינת רשימת הדפים",
        state_mismatch: "שגיאת אבטחה — נסה להתחבר שוב",
        server_error: "שגיאת שרת — נסה שוב",
      };
      toast.error(messages[error] ?? "שגיאה בחיבור ל-Meta");
      window.history.replaceState({}, "", "/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data, isLoading, isError, refetch } = useMetaConnections();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectMeta();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fbConnection = data?.find((c) => c.platform === "FACEBOOK");
  const igConnection = data?.find((c) => c.platform === "INSTAGRAM");

  const handleDisconnect = (id: string) => setConfirmId(id);

  const handleConfirmDisconnect = () => {
    if (!confirmId) return;
    disconnect(confirmId, {
      onSuccess: () => toast.success("החיבור נותק בהצלחה"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "שגיאה בניתוק"),
      onSettled: () => setConfirmId(null),
    });
  };

  return (
    <div>
      <Suspense>
        <OAuthFeedback />
      </Suspense>
      <Topbar title="הגדרות" showAction={false} />
      <div className="p-6 max-w-xl">
        {/* Section header */}
        <div className="mb-2">
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: "#64748B" }}
          >
            חיבורי Meta
          </h2>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2
                className="w-5 h-5 animate-spin"
                style={{ color: "#6B5CF6" }}
              />
              <span className="text-sm" style={{ color: "#94A3B8" }}>
                טוען חיבורים...
              </span>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div
              className="rounded-xl border p-5 flex flex-col items-center gap-3 text-center"
              style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
            >
              <AlertCircle className="w-6 h-6" style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                שגיאה בטעינת החיבורים
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                style={{
                  borderColor: "#2D3148",
                  color: "#94A3B8",
                  backgroundColor: "transparent",
                }}
              >
                נסה שוב
              </Button>
            </div>
          )}

          {/* Cards */}
          {!isLoading && !isError && (
            <div className="flex flex-col gap-3">
              <PlatformCard
                platform="FACEBOOK"
                connection={fbConnection}
                onDisconnect={handleDisconnect}
                isDisconnecting={isDisconnecting && confirmId === fbConnection?.id}
              />
              <PlatformCard
                platform="INSTAGRAM"
                connection={igConnection}
                onDisconnect={handleDisconnect}
                isDisconnecting={isDisconnecting && confirmId === igConnection?.id}
              />
            </div>
          )}
        </div>

        {/* Info note */}
        {!isLoading && !isError && !fbConnection && !igConnection && (
          <div
            className="mt-4 rounded-lg border px-4 py-3 flex items-start gap-2"
            style={{ borderColor: "#2D3148", backgroundColor: "#13151F" }}
          >
            <CheckCircle2
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              style={{ color: "#64748B" }}
            />
            <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
              חיבור לפייסבוק מאפשר פרסום אוטומטי לדפי פייסבוק ולחשבונות
              אינסטגרם עסקיים המקושרים אליהם.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
        title="ניתוק חיבור"
        description="לנתק את החיבור הזה? פרסום אוטומטי יופסק."
        confirmLabel="נתק"
        cancelLabel="ביטול"
        onConfirm={handleConfirmDisconnect}
        isLoading={isDisconnecting}
      />
    </div>
  );
}
