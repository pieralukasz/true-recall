export const BASIC_V2_RULES = `MANDATORY MINDSET & RULES:
- EXHAUSTIVE, NOT SUMMARIZED: Never reduce card count due to text length. Create as many cards as needed — even 15+ from a single fragment. Every technical term, concept, and detail gets its own card.
- HYPER-ATOMICITY: One flashcard = EXACTLY ONE piece of information in the Back. Break complex definitions apart entirely.
- NUMBERED LISTS & BULLETS IN SOURCE: Each list item in the source text becomes its own atomic card.
- TABLES & CODE BLOCKS: Treat each table row and each code line as an atomic fact. Use the full table or code block as the source quote.
- THE MERGE RULE: If multiple cards would have identical questions, MERGE them into one card. List all answers as Markdown bullet points (\`- item\`) in the Back — this is the ONLY time bullet points appear in the Back.
- PERFECT QUOTES: The <!-- source: --> must be a verbatim copy of the single sentence proving the fact. If a fact spans two sentences, join both sentences as one quote. No labels, no quotation marks.
- CONTEXT-FREE & CONCRETE: Every question must be fully understandable without the source text. Add a distinguishing cue when concepts are similar (e.g., "Unlike X, what does Y...").
- LANGUAGE MATCH: Always use the exact same language as the source text — if the source is Polish, all cards must be in Polish; if English, in English. Never switch languages regardless of card count or complexity.
- If the text contains absolutely no new information, return ONLY: NO_NEW_CARDS.

MARKDOWN & BACKLINK FORMATTING (CRITICAL):
- BOLDING: Bold the core target keyword or concept in every question using **bold**.
- BACKLINKS: Wrap ALL key nouns in [[backlinks]] (lowercase) — this includes proper names, domain-specific terms, scientific terms, and any concept that would have its own Obsidian note. Proper nouns (e.g., people's names, cities) are always wrapped in backlinks, identical to domain terms.
- COMBINED: When a term needs both bold and a backlink, use **[[term]]**.
- ALIASES: Use [[term|alias]] when needed for readability. NEVER use [term](app://obsidian.md/term). Double brackets only.
- Separate cards with --- on its own line.

ANSWER QUALITY RULES:
- BREVITY: Remove every unnecessary word from the Back. The overriding principle is "less is more." Move context into the question so the Back contains only the missing piece. Definitional answers ("What is X?") may be longer but must still be stripped of filler. Non-definitional answers should aim for 1–3 words.
- SELF-CONTAINED ANSWER: The Back must state the fact directly — never reference the source text with phrases like "according to the text," "as stated," or "in the text." The answer stands alone as a memory fact.
- NO META-REFERENCES: Questions must never contain scene-relative or text-relative qualifiers such as "in the described scene," "in the text," "as described," "in question," or any phrase that implies the answer only exists within a document or fictional frame. Ask about the concept or subject directly, as if stating a fact about the world.
- CONCRETE, NOT ATTRIBUTED: Write as if stating a fact about the world, not summarizing a reading.
- ONE ANSWER ONLY: The Back must never contain two pieces of information unless triggered by the Merge Rule. If a question could yield two facts, split it into two separate cards.

ANSWER BREVITY (BAD vs GOOD):

Definitional — concise but complete:
Front: Jak zdefiniowałbyś **[[wolt]]**?
Back: Różnica potencjału elektrycznego między dwoma miejscami
GOOD — definition, no filler, every word earns its place.

Non-definitional — move context to question:
BAD:
Front: What does **[[RAG]]** combine to work?
Back: The generative capabilities of models like GPT-4 with precise information retrieval mechanisms
GOOD (split into 2 cards):
Front: What generative model does **[[RAG]]** combine with retrieval?
Back: [[gpt-4]]
---
Front: What does **[[RAG]]** combine with generative capabilities?
Back: Retrieval mechanisms

BAD:
Front: Why do **[[llms]]** have limited knowledge?
Back: They can only generate responses based on their training data
GOOD:
Front: **[[LLMs]]** can only generate responses based on what?
Back: Training data

BAD:
Front: What kind of answers do **[[llms]]** provide without external sources?
Back: Vague or imprecise answers
GOOD:
Front: Without external sources, **[[llms]]** provide what kind of answers?
Back: Vague, imprecise

ANTI-RULES (NEVER DO THIS):
- Anti-Tautology: The question must never contain the answer.
- Anti-Order: Never ask "What is the first/second/next…" — ask about the concept directly.
- Anti-List: No bullet points in the Back unless triggered by the Merge Rule.
- Anti-Boolean: Never ask Yes/No questions.
- Anti-Example-Trap: Never ask "What is an example of X?" — state the example, ask for the category.
- Anti-Source-Reference: Never phrase a question as "According to the text, what is...?", "in the described scene", "as described", or any variant that makes the question context-dependent.`;
