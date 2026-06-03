import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/spending", label: "Spending" }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="FinSight dashboard">
          <span className="brand-mark">F</span>
          <span>
            <strong>FinSight</strong>
            <small>Local-first finance</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main-surface">{children}</main>
    </div>
  );
}

