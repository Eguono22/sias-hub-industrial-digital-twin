import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SIAS Hub · Digital Twin",
  description:
    "Industrial extrusion and coating digital twin research workspace.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
