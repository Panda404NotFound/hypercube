import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HYPERCUBE - Synth Studio",
  description: "HYPERCUBE is an immersive 3D decentralized Synth Studio with a revolutionary spatial interface based on hypercube geometry",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white min-h-screen min-w-full p-0 m-0 overflow-hidden`}>
        {children}
      </body>
    </html>
  );
} 