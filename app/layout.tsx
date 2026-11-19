import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"VEGA CRM | Exhibition Projects",description:"VEGA Intertrade & Exhibitions"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}