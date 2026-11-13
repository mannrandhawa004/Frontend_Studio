import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "Tessera — Curated React templates",
    template: "%s — Tessera",
  },
  description:
    "Tessera is a curated showcase of standout React, Next.js, and HTML/CSS templates with live, responsive previews.",
};

export const viewport: Viewport = {
  themeColor: "#f4f1e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
