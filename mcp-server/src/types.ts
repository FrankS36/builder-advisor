// Core types for the Builder Advisor system

export interface DecisionPattern {
  id: string;
  title: string;
  situation: string;
  common_mistakes: string[];
  challenge_questions: string[];
  decision_factors: string[];
  anti_patterns: string[];
  tags: string[];
}

export interface BuilderContext {
  id: string;
  name: string;
  building: string;
  stage: string;
  constraints: string[];
  goals: string[];
  updated_at: string;
}

export interface DecisionEntry {
  id: string;
  builder_id: string;
  date: string;
  decision: string;
  reasoning: string;
  alternatives_considered: string[];
  pattern_id?: string;
  outcome?: string;
  outcome_date?: string;
}

export interface ChallengeResponse {
  situation_understanding: string;
  relevant_patterns: DecisionPattern[];
  challenge_questions: string[];
  blind_spots: string[];
  precedents: DecisionEntry[];
  recommendation: string;
}
