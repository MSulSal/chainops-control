import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainOps Control",
  description: "Reviewer workspace for public wallet case operations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

