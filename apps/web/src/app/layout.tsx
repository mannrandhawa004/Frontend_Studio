import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frontend Studio",
  description: "A curated frontend template workspace",
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
