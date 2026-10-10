import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: "Aangan Studio · Enquiry courtyard",
  description: "Every call to Aangan Studio, beautifully handled.",
  // Caller details are on these pages: keep them out of search engines.
  robots: { index: false, follow: false },
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path d='M8 44V22a16 16 0 0 1 32 0v22z' fill='%23f6dccf' stroke='%23b9603e' stroke-width='3'/><path d='M19 41h10l-1.5 4h-7z' fill='%23b08a3e'/><path d='M24 41c0-7 0-10-5-14M24 41c0-6 1-9 6-12' stroke='%234e8a50' stroke-width='2.5' fill='none'/></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
