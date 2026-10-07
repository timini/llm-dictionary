import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LLM Dictionary — words, connected",
  description:
    "Explore the meaning of any word and discover semantic connections between two words.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
