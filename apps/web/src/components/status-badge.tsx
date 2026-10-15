import type { DocumentStatus } from "@openrag/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "En attente",
  processing: "En cours",
  ready: "Prêt",
  failed: "Échec",
};

const STATUS_STYLES: Record<DocumentStatus, string> = {
  pending: "bg-zinc-800 text-zinc-300 border-zinc-700",
  processing: "bg-blue-950 text-blue-300 border-blue-800",
  ready: "bg-emerald-950 text-emerald-300 border-emerald-800",
  failed: "bg-red-950 text-red-300 border-red-800",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
