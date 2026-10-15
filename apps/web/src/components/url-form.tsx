"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UrlForm({ onSubmit }: { onSubmit: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!url.trim()) return;

        setIsSubmitting(true);
        onSubmit(url.trim()).finally(() => {
          setUrl("");
          setIsSubmitting(false);
        });
      }}
    >
      <Input
        type="url"
        placeholder="https://exemple.com/page"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" disabled={isSubmitting || !url.trim()}>
        Ajouter l&apos;URL
      </Button>
    </form>
  );
}
