import { Badge } from "@/components/ui/badge";
import {
  RequestStatus, RequestStatusLabels,
  DraftStatus, DraftStatusLabels,
  PublishJobStatus, PublishJobStatusLabels,
} from "@/types";

const requestStatusStyles: Record<RequestStatus, { backgroundColor: string; color: string }> = {
  [RequestStatus.NEW]: { backgroundColor: "#1e293b", color: "#94A3B8" },
  [RequestStatus.IN_PROGRESS]: { backgroundColor: "#1e3a5f", color: "#60a5fa" },
  [RequestStatus.DRAFT_READY]: { backgroundColor: "#2d1b69", color: "#a78bfa" },
  [RequestStatus.REVISION_NEEDED]: { backgroundColor: "#451a03", color: "#fb923c" },
  [RequestStatus.COMPLETED]: { backgroundColor: "#14532d", color: "#4ade80" },
  [RequestStatus.CANCELLED]: { backgroundColor: "#1c1917", color: "#78716c" },
};

const draftStatusStyles: Record<DraftStatus, { backgroundColor: string; color: string }> = {
  [DraftStatus.PENDING_REVIEW]: { backgroundColor: "#2d1b69", color: "#a78bfa" },
  [DraftStatus.APPROVED]: { backgroundColor: "#14532d", color: "#4ade80" },
  [DraftStatus.REVISION_NEEDED]: { backgroundColor: "#451a03", color: "#fb923c" },
  [DraftStatus.REJECTED]: { backgroundColor: "#450a0a", color: "#f87171" },
  [DraftStatus.EDITED]: { backgroundColor: "#1e3a5f", color: "#60a5fa" },
};

const publishJobStatusStyles: Record<PublishJobStatus, { backgroundColor: string; color: string }> = {
  [PublishJobStatus.QUEUED]: { backgroundColor: "#1e293b", color: "#94A3B8" },
  [PublishJobStatus.SCHEDULED]: { backgroundColor: "#1e3a5f", color: "#60a5fa" },
  [PublishJobStatus.PUBLISHED]: { backgroundColor: "#14532d", color: "#4ade80" },
  [PublishJobStatus.FAILED]: { backgroundColor: "#450a0a", color: "#f87171" },
  [PublishJobStatus.CANCELLED]: { backgroundColor: "#1c1917", color: "#78716c" },
};

interface RequestStatusBadgeProps {
  status: RequestStatus;
}

interface DraftStatusBadgeProps {
  status: DraftStatus;
}

interface PublishJobStatusBadgeProps {
  status: PublishJobStatus;
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const style = requestStatusStyles[status];
  return (
    <Badge className="text-xs font-medium border-0" style={style}>
      {RequestStatusLabels[status]}
    </Badge>
  );
}

export function DraftStatusBadge({ status }: DraftStatusBadgeProps) {
  const style = draftStatusStyles[status];
  return (
    <Badge className="text-xs font-medium border-0" style={style}>
      {DraftStatusLabels[status]}
    </Badge>
  );
}

export function PublishJobStatusBadge({ status }: PublishJobStatusBadgeProps) {
  const style = publishJobStatusStyles[status];
  return (
    <Badge className="text-xs font-medium border-0" style={style}>
      {PublishJobStatusLabels[status]}
    </Badge>
  );
}
