import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEGA CRM | Exhibition Projects",
  description: "VEGA Intertrade & Exhibitions project command centre"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
