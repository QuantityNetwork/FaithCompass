import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SAGOLIK_PUBLIC_URL ?? "https://mcp.sagolik.com"),
  title: { default: "Sagolik MCP — The agent interface to Sagolik", template: "%s · Sagolik MCP" },
  description:
    "Secure infrastructure that lets AI agents understand, simulate, prepare and execute financial and real-estate workflows through Sagolik.",
  applicationName: "Sagolik MCP",
  openGraph: { title: "Sagolik MCP", description: "The agent interface to Sagolik.", siteName: "Sagolik MCP", type: "website" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas">{children}</body>
    </html>
  );
}
