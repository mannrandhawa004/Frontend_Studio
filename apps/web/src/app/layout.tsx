import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "Frontend Studio — Curated React templates",
    template: "%s — Frontend Studio",
  },
  description:
    "A curated showcase and private workspace for reviewing and publishing standout React and web templates.",
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
