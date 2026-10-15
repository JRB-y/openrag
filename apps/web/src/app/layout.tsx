import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenRag",
  description: "Assistant documentaire local (RAG)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
