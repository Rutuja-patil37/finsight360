import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinSight 360 - Personal Finance Planner",
  description: "Personalized Financial Projections & Goal Conflict Optimizer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-white selection:text-black">{children}</body>
    </html>
  );
}
