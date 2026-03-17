import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { DecisionPattern, BuilderContext, DecisionEntry } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory stores (swap for a database in production)
const builderContexts: Map<string, BuilderContext> = new Map();
const decisionJournal: Map<string, DecisionEntry[]> = new Map();

// Load patterns from JSON
function loadPatterns(): DecisionPattern[] {
  const patternsPath = join(__dirname, "..", "data", "patterns.json");
  const raw = readFileSync(patternsPath, "utf-8");
  return JSON.parse(raw) as DecisionPattern[];
}

let patterns: DecisionPattern[] = [];

export function getPatterns(): DecisionPattern[] {
  if (patterns.length === 0) {
    patterns = loadPatterns();
  }
  return patterns;
}

/**
 * Find patterns relevant to a given situation description.
 * Uses keyword matching against tags, titles, and situation text.
 */
export function findRelevantPatterns(
  query: string,
  limit: number = 3
): DecisionPattern[] {
  const all = getPatterns();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  // Domain-specific synonyms to improve matching
  const synonyms: Record<string, string[]> = {
    pricing: ["price", "charge", "charging", "cost", "expensive", "cheap", "afford", "pay", "paying", "revenue", "money", "fee"],
    launch: ["ship", "shipping", "release", "deploy", "live", "publish"],
    pivot: ["change", "switch", "direction", "abandon", "restart"],
    burnout: ["tired", "exhausted", "overwhelmed", "stressed", "quit", "break"],
    cofounder: ["partner", "co-founder", "cofounder", "alone", "solo", "team"],
    audience: ["users", "customers", "followers", "community", "distribution"],
  };

  // Expand query with synonym-matched tags
  const expandedTags: string[] = [];
  for (const [tag, words] of Object.entries(synonyms)) {
    if (queryWords.some((w) => words.includes(w) || w === tag)) {
      expandedTags.push(tag);
    }
  }

  const scored = all.map((pattern) => {
    let score = 0;
    const searchText = [
      pattern.title,
      pattern.situation,
      ...pattern.tags,
      ...pattern.common_mistakes,
      ...pattern.challenge_questions,
      ...pattern.decision_factors,
    ]
      .join(" ")
      .toLowerCase();

    // Tag matches are highest signal
    for (const tag of pattern.tags) {
      if (queryLower.includes(tag)) score += 10;
      if (expandedTags.includes(tag)) score += 10;
    }

    // Title word matches (only words > 3 chars to reduce noise)
    const titleWords = pattern.title.toLowerCase().split(/\s+/);
    for (const word of queryWords) {
      if (word.length > 3 && titleWords.some((tw) => tw.includes(word))) score += 5;
    }

    // General content matches (only words > 3 chars)
    for (const word of queryWords) {
      if (word.length <= 3) continue;
      const occurrences = (searchText.match(new RegExp(word, "g")) || [])
        .length;
      score += occurrences;
    }

    return { pattern, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.pattern);
}

/**
 * Get a specific pattern by ID
 */
export function getPatternById(id: string): DecisionPattern | undefined {
  return getPatterns().find((p) => p.id === id);
}

// --- Builder Context Management ---

export function setBuilderContext(context: BuilderContext): void {
  builderContexts.set(context.id, context);
}

export function getBuilderContext(
  builderId: string
): BuilderContext | undefined {
  return builderContexts.get(builderId);
}

// --- Decision Journal ---

export function addDecision(entry: DecisionEntry): void {
  const existing = decisionJournal.get(entry.builder_id) || [];
  existing.push(entry);
  decisionJournal.set(entry.builder_id, existing);
}

export function getDecisions(builderId: string): DecisionEntry[] {
  return decisionJournal.get(builderId) || [];
}

export function findPrecedents(
  builderId: string,
  query: string
): DecisionEntry[] {
  const decisions = getDecisions(builderId);
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  return decisions.filter((d) => {
    const text = [d.decision, d.reasoning, ...d.alternatives_considered]
      .join(" ")
      .toLowerCase();
    return queryWords.some((w) => text.includes(w));
  });
}

export function recordOutcome(
  builderId: string,
  decisionId: string,
  outcome: string
): DecisionEntry | undefined {
  const decisions = decisionJournal.get(builderId) || [];
  const entry = decisions.find((d) => d.id === decisionId);
  if (entry) {
    entry.outcome = outcome;
    entry.outcome_date = new Date().toISOString();
  }
  return entry;
}
