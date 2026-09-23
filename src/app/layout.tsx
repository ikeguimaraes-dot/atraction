import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ION · Gestão empresarial",
  description:
    "Gestão de empresas, clientes, contratos e finanças em um só lugar.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg?v=ion" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6547d9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
