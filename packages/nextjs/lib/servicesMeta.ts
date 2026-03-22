/**
 * Static metadata for each service type (keyed by contract slug).
 * Used by the unified service pages for display purposes.
 */

interface ServiceMeta {
  emoji: string;
  tagline: string;
  bullets: string[];
  heroImage?: string;
  heroPosition?: "left" | "right";
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
}

export const SERVICE_META: Record<string, ServiceMeta> = {
  consult: {
    emoji: "💬",
    tagline: "Get clear answers and a concrete plan — fast.",
    bullets: [
      "A focused chat session with LeftClaw about your idea",
      "Architecture advice, stack recommendations, feasibility checks",
      "Ends with a written build plan you can act on immediately",
      "Plan auto-populates a job post if you want LeftClaw to build it",
    ],
    heroImage: "/hero-builder.png",
    heroPosition: "right",
    descriptionLabel: "What do you want to build?",
    descriptionPlaceholder: "e.g. A staking dApp where users earn ETH rewards on CLAWD deposits...",
  },
  "consult-deep": {
    emoji: "🧠",
    tagline: "Deep-dive into complex architecture, protocol design, or strategy.",
    bullets: [
      "A longer, open-ended session to work through a complex idea",
      "Multi-contract systems, tokenomics, security tradeoffs, protocol design",
      "Ends with a detailed written build plan",
      "Plan auto-populates a job post if you want LeftClaw to build it",
    ],
    heroImage: "/hero-builder.png",
    heroPosition: "right",
    descriptionLabel: "What complex problem do you want to explore?",
    descriptionPlaceholder: "e.g. Design a cross-chain bridge with optimistic verification...",
  },
  audit: {
    emoji: "🛡️",
    tagline: "AI-powered security review of your Solidity contracts.",
    bullets: [
      "Vulnerabilities, logic errors, access control issues, gas optimizations",
      "Detailed written report with severity ratings",
      "Recommendations for fixes and best practices",
      "Tracked on-chain — payment escrowed until review is accepted",
    ],
    heroImage: "/hero-audit.png",
    heroPosition: "left",
    descriptionLabel: "What contract should we audit?",
    descriptionPlaceholder: "Paste the contract address (verified on Basescan/Etherscan) or paste source code. Include any relevant context about what the contract does.",
  },
  qa: {
    emoji: "🔍",
    tagline: "Comprehensive UX, accessibility, and functionality audit of your dApp frontend.",
    bullets: [
      "Full frontend walkthrough with detailed bug reports",
      "Accessibility, responsiveness, and UX analysis",
      "Prioritized fix list with severity ratings",
      "Written report delivered as a job result",
    ],
    heroImage: "/hero-qa.png",
    heroPosition: "right",
    descriptionLabel: "What dApp should we QA?",
    descriptionPlaceholder: "Include the dApp URL, contract address, or GitHub repo link. Mention specific areas of concern if any.",
  },
  build: {
    emoji: "⚒️",
    tagline: "Full-day dedicated build session. LeftClaw builds exactly what you need.",
    bullets: [
      "A full work day of focused building from LeftClaw",
      "Smart contracts, frontends, integrations, migrations",
      "Direct chat during the build for feedback and adjustments",
      "All work tracked on-chain with escrow protection",
    ],
    heroImage: "/hero-builder.png",
    heroPosition: "right",
    descriptionLabel: "What should we build?",
    descriptionPlaceholder: "Describe the project in detail. Include tech stack preferences, existing repos, deployment targets, and any constraints.",
  },
};

/**
 * Additional metadata for services that don't have their own slug route
 * but need page-level config (Oracle, Research, etc.)
 */
export const EXTRA_SERVICE_META: Record<string, ServiceMeta & { contractSlug?: string }> = {
  oracle: {
    emoji: "⚖️",
    tagline: "Schedule onchain actions triggered by real-world outcomes.",
    bullets: [
      "Define a condition and a future datetime",
      "Clawd monitors specified URLs for the outcome",
      "Executes the onchain action automatically when conditions are met",
      "Full audit trail of checks and execution",
    ],
    heroImage: "/hero-oracle.png",
    heroPosition: "right",
    descriptionLabel: "Describe your oracle job",
    descriptionPlaceholder: "What condition should trigger the action? Include URLs to monitor, the datetime, and the onchain action to execute.",
  },
  research: {
    emoji: "🔬",
    tagline: "Give Clawd a topic and get back a detailed written research report.",
    bullets: [
      "Deep-dive research on any Ethereum/crypto topic",
      "Protocol analysis, competitive research, on-chain data analysis",
      "Structured report with sources and citations",
      "Useful for governance decisions, investment research, or protocol design",
    ],
    heroImage: "/hero-research.png",
    heroPosition: "left",
    descriptionLabel: "What should we research?",
    descriptionPlaceholder: "Include the topic, specific questions, relevant URLs, and how you plan to use the research.",
  },
  humanqa: {
    emoji: "👤",
    tagline: "Human-powered frontend QA. A real person reviews your dApp.",
    bullets: [
      "Real human manual review — catches what automated tools miss",
      "UX wins, accessibility gaps, functionality problems",
      "Prioritized written report with findings",
      "Delivered as a job result on-chain",
    ],
    heroImage: "/hero-humanqa.png",
    heroPosition: "left",
    descriptionLabel: "What dApp should we review?",
    descriptionPlaceholder: "Include the dApp URL, contract address, or GitHub repo. Mention specific areas of focus if any.",
  },
};
