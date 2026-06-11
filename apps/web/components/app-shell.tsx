"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type ThemeMode = "light" | "dark";

const navItems = [
  { href: "/dashboard", icon: DashboardIcon, label: "Dashboard" },
  { href: "/cash", icon: CashIcon, label: "Cash" },
  { href: "/spending", icon: SpendingIcon, label: "Spending" },
  { href: "/investments", icon: InvestmentsIcon, label: "Investments" },
  { href: "/recap", icon: RecapIcon, label: "Recap" },
  { href: "/transactions", icon: TransactionsIcon, label: "Transactions" },
  { href: "/accounts", icon: AccountsIcon, label: "Accounts" },
  { href: "/settings", icon: SettingsIcon, label: "Settings" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = readStoredPreference("finsight-sidebar-open");
    if (saved) {
      setSidebarOpen(saved === "true");
    }
    const savedTheme = readStoredPreference("finsight-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  function updateSidebar(open: boolean) {
    setSidebarOpen(open);
    writeStoredPreference("finsight-sidebar-open", String(open));
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    writeStoredPreference("finsight-theme", nextTheme);
  }

  return (
    <div className={`app-shell theme-${theme} ${sidebarOpen ? "" : "sidebar-closed"}`}>
      {sidebarOpen ? (
        <aside className="sidebar">
          <div className="sidebar-header">
            <Link className="brand" href="/dashboard" aria-label="FinSight dashboard">
              <span className="brand-mark">
                <BrandLogoIcon />
              </span>
              <span>
                <strong>FinSight</strong>
                <small>Local-first finance</small>
              </span>
            </Link>
            <div className="sidebar-actions">
              <button className="theme-toggle" type="button" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
              <button className="sidebar-toggle" type="button" aria-label="Hide sidebar" onClick={() => updateSidebar(false)}>
                <SidebarCloseIcon />
              </button>
            </div>
          </div>
          <nav className="nav-list" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isActive = isActiveNavItem(pathname, item.href);
              return (
                <Link aria-current={isActive ? "page" : undefined} className={isActive ? "nav-active" : undefined} key={item.href} href={item.href}>
                  <span className="nav-icon" aria-hidden="true">
                    <item.icon />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : (
        <div className="floating-shell-controls">
          <button className="sidebar-open-button" type="button" aria-label="Open sidebar" onClick={() => updateSidebar(true)}>
            <SidebarOpenIcon />
          </button>
          <button className="theme-toggle floating-theme-toggle" type="button" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      )}
      <main className="main-surface">{children}</main>
    </div>
  );
}

function readStoredPreference(key: string) {
  try {
    return window.localStorage?.getItem(key) ?? readCookiePreference(key);
  } catch {
    return readCookiePreference(key);
  }
}

function writeStoredPreference(key: string, value: string) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Cookie fallback below keeps theme/sidebar state stable in restricted browser contexts.
  }
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

function readCookiePreference(key: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function BrandLogoIcon() {
  return (
    <svg aria-label="FinSight logo" role="img" viewBox="0 0 48 48">
      <defs>
        <linearGradient id="brandLogoBg" x1="8" x2="42" y1="7" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe86a" />
          <stop offset="0.45" stopColor="#fbbc04" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="brandLogoArrowShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0.8" dy="1.4" floodColor="#9a6100" floodOpacity="0.32" stdDeviation="1.1" />
        </filter>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#brandLogoBg)" />
      <path
        className="brand-trend-line"
        d="M10.5 33.2 18.3 27.6 24.3 30.2 34.6 18.8"
        fill="none"
        filter="url(#brandLogoArrowShadow)"
        stroke="#fffdf2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.1"
      />
      <path
        className="brand-trend-arrow"
        d="M29.3 18.2h6.5v6.5"
        fill="none"
        filter="url(#brandLogoArrowShadow)"
        stroke="#fffdf2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.1"
      />
      <path
        d="M10.5 33.2 18.3 27.6 24.3 30.2 34.6 18.8M29.3 18.2h6.5v6.5"
        fill="none"
        opacity="0.5"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function isActiveNavItem(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5h1.8M15.7 14.5h1.8" />
    </svg>
  );
}

function SpendingIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 7h10l-1 12H8L7 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="M10 12h4" />
    </svg>
  );
}

function InvestmentsIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 18h16" />
      <path d="M6 15l4-4 3 3 5-7" />
      <path d="M15 7h3v3" />
    </svg>
  );
}

function RecapIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="5" y="4" width="14" height="16" rx="3" />
      <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
    </svg>
  );
}

function TransactionsIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 8h11M7 16h11" />
      <path d="M15 5l3 3-3 3M10 13l-3 3 3 3" />
    </svg>
  );
}

function AccountsIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M8 9h8M8 13h5" />
      <circle cx="17" cy="15.5" r="1.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" />
    </svg>
  );
}

function SidebarCloseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M10 5v14M15 9l-3 3 3 3" />
    </svg>
  );
}

function SidebarOpenIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M10 5v14M12 9l3 3-3 3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M20 15.3A8.2 8.2 0 0 1 8.7 4a7.4 7.4 0 1 0 11.3 11.3Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

