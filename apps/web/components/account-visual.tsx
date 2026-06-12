import React from "react";

import { formatCurrency } from "@/lib/format";
import type { Account } from "@/lib/types";

type InstitutionAsset = {
  card?: string;
  displayName: string;
  logo?: string;
  tone: string;
  words: string[];
};

const INSTITUTIONS: InstitutionAsset[] = [
  { displayName: "CIBC", logo: "/institutions/logos/cibc.jpg", card: "/institutions/cards/cibc-aventura-visa-infinite.png", tone: "visual-cibc", words: ["cibc", "canadian imperial"] },
  { displayName: "RBC", logo: "/institutions/logos/rbc.jpg", card: "/institutions/cards/rbc-avion-visa-infinite.png", tone: "visual-rbc", words: ["rbc", "royal bank"] },
  { displayName: "TD", logo: "/institutions/logos/td.jpg", card: "/institutions/cards/td-cash-back-visa-infinite.jpeg", tone: "visual-td", words: ["td", "canada trust", "toronto dominion"] },
  { displayName: "Scotia", logo: "/institutions/logos/scotiabank.jpg", card: "/institutions/cards/scotia-passport-visa-infinite.png", tone: "visual-scotia", words: ["scotia", "bank of nova scotia"] },
  { displayName: "BMO", logo: "/institutions/logos/bmo.jpg", card: "/institutions/cards/bmo-eclipse-visa-infinite.png", tone: "visual-bmo", words: ["bmo", "bank of montreal"] },
  { displayName: "EQ", logo: "/institutions/logos/eq-bank.jpg", card: "/institutions/cards/eq-bank-card.svg", tone: "visual-eq", words: ["eq", "equitable"] },
  { displayName: "Wealthsimple", logo: "/institutions/logos/wealthsimple.jpg", card: "/institutions/cards/wealthsimple-visa-infinite.svg", tone: "visual-wealthsimple", words: ["wealthsimple"] },
  { displayName: "PC", logo: "/institutions/logos/pc-financial.jpg", card: "/institutions/cards/pc-world-elite-mastercard.png", tone: "visual-pc", words: ["pc financial", "president", "pc money", "pc mastercard"] },
  { displayName: "Rogers", logo: "/institutions/logos/rogers-bank.png", card: "/institutions/cards/rogers-red-mastercard.svg", tone: "visual-rogers", words: ["rogers"] },
  { displayName: "Amex", logo: "/institutions/logos/amex.jpg", card: "/institutions/cards/amex-cobalt.png", tone: "visual-amex", words: ["amex", "american express"] },
  { displayName: "National", logo: "/institutions/logos/national-bank.jpg", tone: "visual-national", words: ["national bank", "banque nationale", "nbc"] },
  { displayName: "Tangerine", logo: "/institutions/logos/tangerine.jpg", tone: "visual-tangerine", words: ["tangerine"] },
  { displayName: "Simplii", logo: "/institutions/logos/simplii.jpg", tone: "visual-simplii", words: ["simplii"] },
  { displayName: "Neo", logo: "/institutions/logos/neo.jpg", tone: "visual-neo", words: ["neo"] },
  { displayName: "Triangle", logo: "/institutions/logos/canadian-tire.jpg", tone: "visual-canadian-tire", words: ["canadian tire", "triangle"] }
];

export function AccountVisual({ account }: { account: Account }) {
  const institutionName = account.institution_name ?? account.name;
  const institution = findInstitution(`${institutionName} ${account.name}`);

  if (account.type === "credit_card") {
    const cardAsset = getCardAsset(account, institution);
    if (cardAsset) {
      return (
        <span className="account-visual card-visual card-visual-image" aria-hidden="true">
          <img alt="" src={cardAsset} />
        </span>
      );
    }

    return (
      <span className={`account-visual card-visual ${institution?.tone ?? "visual-card-default"}`} aria-hidden="true">
        <span>{institution?.displayName ?? getInstitutionName(account.name)}</span>
        <small>{cardNetwork(account.name)}</small>
      </span>
    );
  }

  if (institution?.logo) {
    return (
      <span className="account-visual bank-visual bank-visual-image" aria-hidden="true">
        <img alt="" src={institution.logo} />
      </span>
    );
  }

  const fallbackInstitutionName = institution?.displayName ?? getInstitutionName(institutionName);
  return (
    <span className={`account-visual bank-visual ${institution?.tone ?? "visual-bank-default"}`} aria-hidden="true">
      {fallbackInstitutionName.slice(0, 1)}
    </span>
  );
}

export function accountSubtitle(account: Account) {
  if (account.type === "checking") {
    return `Everyday Banking - ${account.currency}`;
  }
  if (account.type === "savings") {
    return `High Interest Savings - ${account.currency}`;
  }
  if (account.type === "cash") {
    return `Cash balance - ${account.currency}`;
  }
  if (account.type === "credit_card") {
    return `Credit Card - ${account.currency}`;
  }
  return `${formatType(account.type)} - ${account.currency}`;
}

export function sourceLabel(source: string) {
  if (source === "simplefin" || source === "mock_simplefin") {
    return "SimpleFIN";
  }
  if (source === "manual") {
    return "Manual";
  }
  if (source === "csv" || source === "statement" || source === "statement_import") {
    return "Statement";
  }
  return "Imported";
}

export function formatCardBalance(balance: number) {
  return balance < 0 ? `${formatCurrency(Math.abs(balance))} outstanding` : formatCurrency(balance);
}

function findInstitution(name: string) {
  const normalized = normalizeName(name);
  return INSTITUTIONS.find((institution) => institution.words.some((word) => matchesWord(normalized, word)));
}

function getCardAsset(account: Account, institution?: InstitutionAsset) {
  const normalized = normalizeName(`${account.institution_name ?? ""} ${account.name}`);
  if (normalized.includes("american express") || normalized.includes("amex")) {
    if (normalized.includes("green")) {
      return "/institutions/cards/amex-green-card.svg";
    }
    if (normalized.includes("cobalt")) {
      return "/institutions/cards/amex-cobalt.png";
    }
  }
  return institution?.card;
}

function matchesWord(normalizedName: string, word: string) {
  if (word.length <= 3) {
    return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(normalizedName);
  }
  return normalizedName.includes(word);
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getInstitutionName(name: string) {
  return name.split(/\s+/)[0] || "Bank";
}

function cardNetwork(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("amex") || lower.includes("cobalt") || lower.includes("american express")) {
    return "AMEX";
  }
  if (lower.includes("visa")) {
    return "VISA";
  }
  if (lower.includes("mastercard") || lower.includes("master card")) {
    return "MC";
  }
  return "CARD";
}

function formatType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
