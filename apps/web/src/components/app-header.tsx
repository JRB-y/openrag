"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Documents" },
  { href: "/search", label: "Recherche" },
  { href: "/chat", label: "Chat" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-6">
      <h1 className="text-xl font-medium">OpenRag</h1>
      <nav className="flex gap-4 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              pathname === tab.href && "font-medium text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
