import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "FinSight",
  description: "Local-first personal finance dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}

