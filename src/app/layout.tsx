import type { Metadata, Viewport } from "next";
import { Silkscreen } from "next/font/google";
import "./globals.css";

/** Bitmap-flavoured display face, used only for titles and small labels. */
const display = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Make It Canadian",
  description:
    "Turn any PNG into a flapping, South Park style talking avatar for your stream. Upload, tune, paste one link into OBS.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
