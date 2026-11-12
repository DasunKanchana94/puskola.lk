import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Puskola: Sinhala novels, books and audiobooks online", template: "%s | Puskola" },
  description: "Read Sinhala books online. Classic Sinhala literature restored with clear text, in classical and modern Sinhala. සිංහල පොත්, නවකතා සහ ශ්‍රව්‍ය පොත්.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;600;700&family=Noto+Sans+Sinhala:wght@400;600;700&family=Noto+Serif+Sinhala:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className={theme}>{children}</body>
    </html>
  );
}
