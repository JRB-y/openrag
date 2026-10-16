"use client";

import type { Citation } from "@openrag/core";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CitationDialog({
  citation,
  documentTitle,
  onOpenChange,
}: {
  citation: Citation | null;
  documentTitle: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={citation !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            [{citation?.n}] {documentTitle ?? "Document"}
          </DialogTitle>
          <DialogDescription>{citation?.page !== null ? `Page ${citation?.page}` : null}</DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm text-foreground">{citation?.excerpt}</p>
      </DialogContent>
    </Dialog>
  );
}
