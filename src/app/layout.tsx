import type { Metadata } from "next";
import Sidebar from "./_demo/Sidebar";

export const metadata: Metadata = {
  title: "MARKET RADAR AI",
  description: "מודיעין פיננסי וסימולטור $200 — SIMULATION ONLY",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, background: "#0B1220", color: "#E8EEF7", fontFamily: "'Heebo','Assistant',system-ui,sans-serif" }}>
        <Sidebar />
        <div className="mr-main">{children}</div>
      </body>
    </html>
  );
}
