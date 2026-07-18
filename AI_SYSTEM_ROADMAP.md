# True Recall AI System Roadmap

**Date:** 2026-07-17  
**Current milestone:** Conversational flashcard Draft Studio

## Current direction

AI Assistant is the primary user-facing AI system. AI Flashcard Generation and
Card Polish remain available for existing users, but are deprecated compatibility
plugins.

The Assistant now persists an `AIThread` separately from individual model runs.
Each thread owns its messages, current materialized proposal manifest, revision
history, active run, and attention state (`active`, `inbox`, or `archived`). Follow-up
turns update or remove existing proposals by stable ID and may add new cards without
regenerating the entire set. Free-form and modification invocations stay in Draft
Studio. Known flashcard-generation presets run in the background and surface a
non-blocking `Add all` / `Review` notice; their drafts remain recoverable in AI Inbox
until reviewed.

The current milestone covers:

- creating flashcard drafts from selected or supplied text;
- modifying a saved card or a card still open in the editor;
- creating additional cards while modifying a card;
- showing editable proposals next to the invocation point or later in AI Inbox;
- preserving source note path, UID, exact source text, and generation preset;
- preserving all existing generation, Card Polish, and Assistant presets without a
  destructive settings migration.

Known actions use direct capabilities instead of an unnecessary agent-planning
round: generation presets run the generation pipeline, Card Polish presets run the
transformation pipeline, and free-form instructions use the tool-calling agent.
Generation always resolves the persisted preset at execution time and passes its
full prompt to the generation pipeline; the user does not need to restate card style
or answer-length rules in Ask AI.

Runtime workflows use namespaced IDs:

```ts
type AIWorkflowKind = "agent" | "generate-cards" | "modify-card";

interface AIWorkflow {
  id: string; // agent:<id> | generation:<id> | card-polish:<id>
  name: string;
  kind: AIWorkflowKind;
  instruction: string;
  sourcePresetId: string;
}
```

Tasks only persist serializable context. An open flashcard editor registers an
ephemeral session target; accepting a proposal updates that exact editor. If it is
closed, the proposal fails safely instead of mutating a different card. Saved cards
and drafts use optimistic conflict detection before applying changes.

Legacy AI Generation toolbar and command actions delegate to the Assistant queue.
Legacy Card Polish UI remains executable for the first deprecation release, while
the same custom presets are exposed by Assistant in card contexts.

## RAG integration boundary

RAG is a provider of evidence, not a chat implementation. Draft Studio, Knowledge
Chat, and future learning agents depend on the neutral `KnowledgeRetriever`
contract. The current index is exposed through `RagKnowledgeRetriever`; RAG v2 can
replace that adapter without changing conversation or proposal semantics.

Retrieval requests define query, source filters, result and token budgets, and
source diversification. Results are normalized evidence records containing source
identity, path, heading, excerpt, score, and modification time. A future RAG v2
should add stable content hashes and exact source ranges so evidence can be attached
to individual card proposals rather than only to the whole conversation.

## Deliberately deferred learning agent

True Recall already stores enough signals for a learning-aware agent: review
ratings, response time, lapses, FSRS stability and difficulty, problem cards,
session history, source relations, related cards, RAG search, retention, and
workload data. That agent is intentionally out of scope until creation and
modification are stable.

A future learning agent could distinguish between:

- normal forgetting, which should remain FSRS's responsibility;
- an ambiguous or overloaded card;
- a missing prerequisite;
- interference between similar concepts;
- an unsupported or outdated claim;
- a duplicate or low-value card.

It could then propose—never silently apply—clarifying or splitting a card, adding a
prerequisite or contrast card, attaching a source, merging a duplicate, or creating
a focused review session.

Safety boundaries for that future phase:

- one `Again` must never trigger an automatic rewrite;
- the agent must not override FSRS scheduling;
- destructive and bulk operations require explicit approval;
- factual claims need evidence from an exact source range, vault search, or web
  citation;
- proposed workload growth must be visible before accepting new cards.

For AI-created and AI-modified cards, retain workflow/prompt version,
model/provider, acceptance and user edits, evidence, first-review outcome, response
time, later lapses, suspension, and deletion. This will eventually allow prompt
quality to be measured from actual study outcomes rather than subjective tuning.

Return to this phase only after True Recall has one stable task model, one proposal
model, reliable provenance, and shared result surfaces across selection, review,
editors, Inbox, Local API, and MCP.
