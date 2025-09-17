import type {Metadata} from 'next';
import './globals.css';
import { BgReady } from "@/components/bg-ready";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'WebGenius',
  description: 'Generate multiple websites from a single prompt.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <BgReady />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
