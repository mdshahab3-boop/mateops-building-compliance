import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T&M Induction & Compliance",
  description:
    "Contractor induction & compliance for shared facilities — by T&M Management Services.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
