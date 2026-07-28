// Credibility scoring for a source domain/kind. A Google hit is NOT itself proof —
// it only points to a source that must then be opened and verified.
export type SourceKind =
  | "official_site" | "exchange_filing" | "verified_account" | "news_agency"
  | "financial_paper" | "secondary_news" | "blog" | "anonymous";

const KIND_SCORE: Record<SourceKind, number> = {
  official_site: 100, exchange_filing: 95, verified_account: 90, news_agency: 80,
  financial_paper: 70, secondary_news: 50, blog: 30, anonymous: 10,
};

const FILINGS = ["sec.gov", "sedar", "investor."];
const AGENCIES = ["reuters.com", "apnews.com", "bloomberg.com"];
const FINANCIAL = ["ft.com", "wsj.com", "cnbc.com", "marketwatch.com", "calcalist", "globes"];

function isGovDomain(d: string): boolean {
  return d.endsWith(".gov") || d.endsWith(".mil") || d.includes(".gov.") || d.startsWith("gov.")
    || d.includes("gov.il") || d.includes("gov.uk") || d.includes("europa.eu") || d.includes("whitehouse.gov");
}

export function classifyDomain(domain: string, isOfficialCompanyDomain = false): SourceKind {
  const d = domain.toLowerCase();
  if (isOfficialCompanyDomain) return "official_site";
  if (FILINGS.some((f) => d.includes(f))) return "exchange_filing"; // sec.gov before generic .gov
  if (isGovDomain(d)) return "official_site";
  if (AGENCIES.some((a) => d.includes(a))) return "news_agency";
  if (FINANCIAL.some((f) => d.includes(f))) return "financial_paper";
  if (d.includes("blog") || d.includes("medium.com") || d.includes("substack")) return "blog";
  if (!d) return "anonymous";
  return "secondary_news";
}

export function scoreSource(domain: string, isOfficialCompanyDomain = false) {
  const kind = classifyDomain(domain, isOfficialCompanyDomain);
  return { kind, score: KIND_SCORE[kind] };
}

// Several outlets copying ONE original are not independent confirmations.
export function countIndependentSources(domains: string[]): number {
  return new Set(domains.map((d) => d.toLowerCase())).size;
}
