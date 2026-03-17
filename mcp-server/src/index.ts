import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";
import {
  findRelevantPatterns,
  getPatternById,
  getPatterns,
  setBuilderContext,
  getBuilderContext,
  addDecision,
  getDecisions,
  findPrecedents,
  recordOutcome,
} from "./services/patterns.js";
import type { BuilderContext, DecisionEntry } from "./types.js";

const server = new McpServer({
  name: "builder-advisor-mcp-server",
  version: "1.0.0",
});

// ============================================================
// TOOL: advisor_challenge_decision
// The core tool — takes a decision the builder is facing and
// returns a structured challenge with relevant patterns,
// questions, and blind spots.
// ============================================================

server.registerTool(
  "advisor_challenge_decision",
  {
    title: "Challenge a Decision",
    description: `Stress-test a decision a solo builder is facing. Finds relevant decision patterns, surfaces challenging questions, identifies blind spots, and checks for precedents in the builder's decision history.

This is the primary tool — use it when a builder describes a problem, asks for advice, or is trying to make a decision.

Args:
  - situation (string): Description of the decision or problem the builder is facing
  - builder_id (string, optional): Builder's ID to check for context and precedents

Returns:
  Structured challenge with relevant patterns, questions, and analysis.`,
    inputSchema: {
      situation: z
        .string()
        .min(10, "Describe the situation in at least 10 characters")
        .describe("The decision or problem the builder is facing"),
      builder_id: z
        .string()
        .optional()
        .describe("Builder ID to pull context and precedents"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ situation, builder_id }) => {
    const relevantPatterns = findRelevantPatterns(situation, 3);
    const context = builder_id ? getBuilderContext(builder_id) : undefined;
    const precedents = builder_id ? findPrecedents(builder_id, situation) : [];

    // Collect the most relevant challenge questions
    const challengeQuestions = relevantPatterns.flatMap((p) =>
      p.challenge_questions.slice(0, 2)
    );

    // Collect anti-patterns as blind spots
    const blindSpots = relevantPatterns.flatMap((p) => p.anti_patterns);

    const response = {
      situation_understanding: situation,
      builder_context: context || null,
      relevant_patterns: relevantPatterns.map((p) => ({
        id: p.id,
        title: p.title,
        situation: p.situation,
        common_mistakes: p.common_mistakes,
        decision_factors: p.decision_factors,
      })),
      challenge_questions: challengeQuestions,
      blind_spots: blindSpots,
      precedents: precedents.map((p) => ({
        date: p.date,
        decision: p.decision,
        reasoning: p.reasoning,
        outcome: p.outcome || "Not yet recorded",
      })),
      instruction_to_agent:
        "Present these challenges conversationally. Don't just list them — weave them into a genuine pushback on the builder's thinking. Pick the 2-3 most relevant questions and make them specific to the builder's situation. If there are precedents, reference them naturally. The goal is to make the builder think harder, not to overwhelm them.",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    };
  }
);

// ============================================================
// TOOL: advisor_list_patterns
// Browse all decision patterns or filter by tag
// ============================================================

server.registerTool(
  "advisor_list_patterns",
  {
    title: "List Decision Patterns",
    description: `List all available decision patterns, optionally filtered by tag. Use this to browse what patterns exist or to find patterns for a specific domain.

Tags include: revenue, pricing, launch, validation, distribution, content, audience, product, career, transition, risk, financial, family, ideation, commitment, team, cofounder, solo, equity, shipping, mvp, perfectionism, customers, strategy, focus, growth, health, sustainability, mental-health, pace, pivot, persistence, failure, ai, tools, skills, productivity, technical.`,
    inputSchema: {
      tag: z
        .string()
        .optional()
        .describe("Filter patterns by tag (e.g., 'pricing', 'launch')"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ tag }) => {
    let results = getPatterns();

    if (tag) {
      results = results.filter((p) =>
        p.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
      );
    }

    const summary = results.map((p) => ({
      id: p.id,
      title: p.title,
      situation: p.situation,
      tags: p.tags,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { count: summary.length, patterns: summary },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: advisor_get_pattern
// Get full details of a specific pattern
// ============================================================

server.registerTool(
  "advisor_get_pattern",
  {
    title: "Get Decision Pattern",
    description: `Get the full details of a specific decision pattern by ID. Use after listing patterns or when a specific pattern was referenced.`,
    inputSchema: {
      pattern_id: z.string().describe("The pattern ID (e.g., 'pricing-first-product')"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ pattern_id }) => {
    const pattern = getPatternById(pattern_id);

    if (!pattern) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Pattern '${pattern_id}' not found. Use advisor_list_patterns to see available patterns.`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(pattern, null, 2) }],
    };
  }
);

// ============================================================
// TOOL: advisor_set_context
// Store/update the builder's context
// ============================================================

server.registerTool(
  "advisor_set_context",
  {
    title: "Set Builder Context",
    description: `Store or update the builder's personal context — what they're building, their constraints, their goals. This context is used by advisor_challenge_decision to give more relevant challenges.`,
    inputSchema: {
      builder_id: z.string().describe("Unique ID for this builder"),
      name: z.string().describe("Builder's name"),
      building: z
        .string()
        .describe("What they're currently building (product/project description)"),
      stage: z
        .string()
        .describe(
          "Where they are: ideation, building, launched, growing, pivoting, etc."
        ),
      constraints: z
        .array(z.string())
        .describe(
          "Real constraints: budget, time, family, skills, location, etc."
        ),
      goals: z
        .array(z.string())
        .describe(
          "Their actual goals — be specific and honest, not aspirational platitudes"
        ),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ builder_id, name, building, stage, constraints, goals }) => {
    const context: BuilderContext = {
      id: builder_id,
      name,
      building,
      stage,
      constraints,
      goals,
      updated_at: new Date().toISOString(),
    };

    setBuilderContext(context);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { status: "saved", context },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: advisor_log_decision
// Record a decision in the journal
// ============================================================

server.registerTool(
  "advisor_log_decision",
  {
    title: "Log a Decision",
    description: `Record a decision the builder has made, including the reasoning and alternatives considered. Builds a decision journal that gets more valuable over time — the system can reference past decisions when facing new ones.`,
    inputSchema: {
      builder_id: z.string().describe("Builder's ID"),
      decision: z.string().describe("What was decided"),
      reasoning: z.string().describe("Why this was chosen"),
      alternatives_considered: z
        .array(z.string())
        .describe("What other options were evaluated"),
      pattern_id: z
        .string()
        .optional()
        .describe("ID of a related decision pattern, if applicable"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({
    builder_id,
    decision,
    reasoning,
    alternatives_considered,
    pattern_id,
  }) => {
    const entry: DecisionEntry = {
      id: `dec_${Date.now()}`,
      builder_id,
      date: new Date().toISOString(),
      decision,
      reasoning,
      alternatives_considered,
      pattern_id,
    };

    addDecision(entry);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { status: "logged", entry },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: advisor_record_outcome
// Update a past decision with what actually happened
// ============================================================

server.registerTool(
  "advisor_record_outcome",
  {
    title: "Record Decision Outcome",
    description: `Record the outcome of a past decision. This closes the feedback loop — the system can reference outcomes when the builder faces similar decisions in the future.`,
    inputSchema: {
      builder_id: z.string().describe("Builder's ID"),
      decision_id: z
        .string()
        .describe("ID of the decision to update (from advisor_log_decision)"),
      outcome: z
        .string()
        .describe("What actually happened as a result of this decision"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ builder_id, decision_id, outcome }) => {
    const updated = recordOutcome(builder_id, decision_id, outcome);

    if (!updated) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Decision '${decision_id}' not found for builder '${builder_id}'.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "outcome_recorded", entry: updated }, null, 2),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: advisor_review_journal
// Review the builder's decision history
// ============================================================

server.registerTool(
  "advisor_review_journal",
  {
    title: "Review Decision Journal",
    description: `Review a builder's decision history. Useful for reflection, spotting patterns in decision-making, and finding precedents.`,
    inputSchema: {
      builder_id: z.string().describe("Builder's ID"),
      search: z
        .string()
        .optional()
        .describe("Optional search term to filter decisions"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ builder_id, search }) => {
    let decisions: DecisionEntry[];

    if (search) {
      decisions = findPrecedents(builder_id, search);
    } else {
      decisions = getDecisions(builder_id);
    }

    const summary = {
      builder_id,
      total_decisions: decisions.length,
      decisions_with_outcomes: decisions.filter((d) => d.outcome).length,
      entries: decisions.map((d) => ({
        id: d.id,
        date: d.date,
        decision: d.decision,
        reasoning: d.reasoning,
        outcome: d.outcome || "Pending",
        pattern_id: d.pattern_id,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);

// ============================================================
// Transport setup
// ============================================================

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Builder Advisor MCP server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "builder-advisor-mcp-server" });
  });

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(
      `Builder Advisor MCP server running on http://localhost:${port}/mcp`
    );
  });
}

const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
