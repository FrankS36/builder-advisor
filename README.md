# Builder Advisor

**A decision partner for solo builders — not a knowledge base, a thinking tool.**

Solo builders don't need more information. They need pushback. Builder Advisor gives any AI agent the ability to stress-test your decisions using proven patterns from real solo builder journeys.

## What's In This Repo

```
builder-advisor/
├── mcp-server/          # MCP server (TypeScript) — the live brain
│   ├── src/
│   │   ├── index.ts     # Server entry with all 7 registered tools
│   │   ├── types.ts     # TypeScript type definitions
│   │   ├── services/
│   │   │   └── patterns.ts  # Pattern matching, context, journal logic
│   │   └── data/
│   │       └── patterns.json  # 10 decision patterns (the core content)
│   ├── package.json
│   └── tsconfig.json
│
├── skill/               # Agent Skill (open standard)
│   └── SKILL.md         # Portable skill file — works in Claude, Codex,
│                        #   Copilot, Cursor, VS Code, and any compatible agent
│
├── site/                # Landing page + machine-readable llms.txt
│   ├── index.html
│   └── llms.txt
│
└── README.md
```

## Quick Start

### Option 1: Just the Skill (no server needed)

The SKILL.md file works standalone. It embeds the core decision patterns directly, so any compatible agent can act as your decision partner without connecting to the MCP server.

1. Copy `skill/SKILL.md` to your skills directory:
   - **Claude Code**: `~/.claude/skills/builder-advisor/SKILL.md`
   - **Codex**: `~/.codex/skills/builder-advisor/SKILL.md`
   - **Copilot/VS Code**: `.github/skills/builder-advisor/SKILL.md`
   - **Cursor**: `.cursor/skills/builder-advisor/SKILL.md`
   - **Claude.ai**: Zip the skill folder and upload in Settings > Skills

2. Start talking to your agent about a decision. It will challenge you.

### Option 2: Full System (Skill + MCP Server)

The MCP server adds: semantic pattern matching, builder context persistence, a decision journal with precedent tracking, and outcome recording.

```bash
cd mcp-server
npm install
npm run build
npm start  # Runs on stdio by default

# For HTTP transport:
TRANSPORT=http PORT=3000 npm start
```

Then connect the MCP server in your agent:
- **Claude Desktop**: Add to your MCP settings with the stdio command
- **Codex**: Reference in `agents/openai.yaml`
- **HTTP mode**: Point any MCP client at `http://localhost:3000/mcp`

## The 7 MCP Tools

| Tool | Purpose |
|------|---------|
| `advisor_challenge_decision` | **The core tool.** Send a situation, get back patterns, questions, and blind spots. |
| `advisor_list_patterns` | Browse all decision patterns, optionally filtered by tag. |
| `advisor_get_pattern` | Get full details of a specific pattern by ID. |
| `advisor_set_context` | Store what the builder is working on, their stage, constraints, and goals. |
| `advisor_log_decision` | Record a decision with reasoning and alternatives considered. |
| `advisor_record_outcome` | Close the feedback loop — record what actually happened. |
| `advisor_review_journal` | Review decision history, spot patterns in your own behavior. |

## The 10 Decision Patterns

1. **Pricing Your First Product** — Value-based pricing vs. the race to free
2. **Building Audience vs. Product First** — Distribution vs. building tension
3. **When to Leave Your Day Job** — Making the transition with eyes open
4. **Choosing What to Build** — Committing when everything's uncertain
5. **Going Solo vs. Finding a Co-founder** — Honesty about what you need
6. **When to Ship vs. Keep Building** — The one-more-feature loop
7. **Saying No to Customers** — Protecting your product vision
8. **Recognizing Burnout** — Catching it before it catches you
9. **When to Pivot vs. Persist** — Distinguishing hard from wrong
10. **AI Tools vs. Manual Work** — Force multiplier vs. crutch

Each pattern includes: situation description, common mistakes, challenge questions, decision factors, and named anti-patterns.

## Architecture Philosophy

**The knowledge base isn't the product. The relationship between the system and the builder is the product.**

Most AI tools give you answers. This one gives you better questions. The MCP server maintains your context and decision history so challenges get more relevant over time. The Agent Skill teaches any compatible agent how to use that context to push back on your thinking.

The decision journal is the sleeper feature. After a few months of logging decisions and recording outcomes, the system becomes a mirror — it can show you your own decision-making patterns, which is something no amount of external advice can provide.

## Adding Your Own Patterns

Patterns live in `mcp-server/src/data/patterns.json`. Each pattern follows this structure:

```json
{
  "id": "your-pattern-id",
  "title": "Pattern Title",
  "situation": "When this pattern applies",
  "common_mistakes": ["Mistake 1", "Mistake 2"],
  "challenge_questions": ["Question 1?", "Question 2?"],
  "decision_factors": ["Factor 1", "Factor 2"],
  "anti_patterns": ["The Named Pattern: description"],
  "tags": ["tag1", "tag2"]
}
```

If you add patterns, also update the embedded patterns section in `skill/SKILL.md` so the standalone skill stays in sync.

## Production Deployment

For a real deployment, you'll want to:

1. **Swap the in-memory stores for a database** — the context and journal stores in `services/patterns.ts` use `Map` objects. Replace with SQLite, Postgres, or any persistence layer.
2. **Add authentication** — the MCP server currently has no auth. Add API key validation or OAuth for the HTTP transport.
3. **Deploy the HTTP server** — any Node.js hosting works (Railway, Fly.io, Render, etc.)
4. **Host the site** — the `site/` directory is static HTML. Deploy anywhere.

## License

MIT — build whatever you want with this.
