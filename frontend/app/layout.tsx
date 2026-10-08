import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "Route 53 | AWS Console", description: "Route 53 management console" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
