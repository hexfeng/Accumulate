import Link from "next/link";
import React from "react";

type PlaceholderViewProps = {
  description: string;
  eyebrow: string;
  primaryActionHref?: string;
  primaryActionLabel?: string;
  title: string;
};

export function PlaceholderView({ description, eyebrow, primaryActionHref = "/dashboard", primaryActionLabel = "Back to dashboard", title }: PlaceholderViewProps) {
  return (
    <section className="placeholder-page" aria-labelledby="placeholder-title">
      <div className="placeholder-card">
        <span>{eyebrow}</span>
        <h1 id="placeholder-title">{title}</h1>
        <p>{description}</p>
        <div className="placeholder-actions">
          <Link className="placeholder-primary" href={primaryActionHref}>
            {primaryActionLabel}
          </Link>
          <Link className="placeholder-secondary" href="/transactions">
            Review transactions
          </Link>
        </div>
      </div>
    </section>
  );
}
