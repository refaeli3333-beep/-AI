"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS: [string, string, string][] = [
  ["/", "בית · סריקה חכמה", "🏠"],
  ["/signals", "אותות עכשיו", "📡"],
  ["/signal", "פרטי אות", "🔎"],
  ["/people", "אנשים במעקב", "👥"],
  ["/person", "פרטי אדם", "🧑"],
  ["/simulator", "סימולציית $200", "💵"],
  ["/sectors", "סקטורים", "🗂️"],
  ["/assets", "נכסים", "📈"],
  ["/compare", "השוואת אנשים", "⚖️"],
  ["/history", "היסטוריה ו-Backtesting", "🕰️"],
  ["/alerts", "התראות", "🔔"],
  ["/scans", "סריקות אחרונות", "🛰️"],
  ["/connections", "חיבורים ומקורות", "🔌"],
  ["/settings", "הגדרות", "⚙️"],
  ["/graph", "גרף קשרים", "🕸️"],
  ["/radar-brain", "Radar Brain", "🧠"],
  ["/performance", "ביצועים וכיול", "📊"],
  ["/about", "אודות והבהרת סיכונים", "ℹ️"],
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <style>{`
        .mr-hamb { display:none; position:fixed; top:12px; right:12px; z-index:60; background:#111C2E; color:#E8EEF7;
          border:1px solid #1E2D44; border-radius:10px; padding:8px 12px; font-size:18px; cursor:pointer; }
        .mr-overlay { position:fixed; inset:0; background:#0007; z-index:45; }
        .mr-sidebar { position:fixed; top:0; right:0; height:100vh; width:230px; background:#0E1728; border-inline-start:1px solid #1E2D44;
          overflow-y:auto; z-index:50; padding:16px 10px; box-sizing:border-box; }
        .mr-main { margin-inline-end:230px; }
        .mr-link { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; color:#B9C6DA;
          text-decoration:none; font-size:13.5px; margin-bottom:2px; }
        .mr-link:hover { background:#16233A; }
        .mr-link.active { background:#16233A; color:#38E0C4; font-weight:800; }
        @media (max-width: 820px) {
          .mr-hamb { display:block; }
          .mr-main { margin-inline-end:0; padding-top:52px; }
          .mr-sidebar { transform: translateX(100%); transition: transform .25s; }
          .mr-sidebar.open { transform: none; }
        }
        @media (min-width: 821px) { .mr-overlay { display:none; } }
      `}</style>

      <button className="mr-hamb" onClick={() => setOpen(!open)} aria-label="תפריט">☰</button>
      {open && <div className="mr-overlay" onClick={() => setOpen(false)} />}

      <nav className={`mr-sidebar${open ? " open" : ""}`} dir="rtl">
        <div style={{ fontWeight: 900, fontSize: 16, padding: "8px 12px 14px" }}>
          MARKET RADAR <span style={{ color: "#38E0C4" }}>AI</span>
        </div>
        {LINKS.map(([href, label, icon]) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`mr-link${active ? " active" : ""}`} onClick={() => setOpen(false)}>
              <span style={{ fontSize: 16 }}>{icon}</span><span>{label}</span>
            </Link>
          );
        })}
        <div style={{ fontSize: 10.5, color: "#5B6b83", padding: "12px", marginTop: 8, borderTop: "1px solid #1E2D44" }}>
          SIMULATION ONLY · אין מסחר אמיתי
        </div>
      </nav>
    </>
  );
}
