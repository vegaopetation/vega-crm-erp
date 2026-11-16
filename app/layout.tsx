import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'VEGA Jewellery Events And Exhibitions',description:'VEGA Jewellery Events And Exhibitions management platform'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
