# Knowledge Management Methodology: Zettelkasten + Flashcards (Complete System)

## System Philosophy

The goal is to create an **Operating System for the Mind** that supports the process:
**UNDERSTAND → REMEMBER → CREATE**

The system separates:
- **Raw data** (Literature, Fleeting)
- **Structure and navigation** (Index, Hub, Structure)
- **Understanding and theory** (Zettel, Person)
- **Application and practice** (Protocol, Application)

---

## Final Methodology: Complete Tag System

### Overview of all `#mind/` tags

| Tag | Title | Purpose | Flashcards |
|-----|-------|---------|------------|
| `#mind/zettel` | CLAIM (sentence) | Your thought/thesis (Theory) | YES |
| `#mind/application` | CONCLUSION (sentence) | Real-life proof/Case Study (Practice) | YES |
| `#mind/protocol` | "How to...?" | Ideal solution/procedure | YES |
| `#mind/question` | QUESTION (?) | Unanswered question | NO |
| `#mind/hub` | Exploration topic | Entry point to "trains of thought" | NO |
| `#mind/structure` | Writing topic | Sandbox for article organization | NO |
| `#mind/index` | Broad category | Empty connector/backlink | NO |
| `#mind/person` | Full name | Person (author, expert, etc.) | NO |

### Overview of `#input/` tags (sources and capture)

| Tag | Usage | Flashcards |
|-----|-------|------------|
| `#input/fleeting` | Quick thought, voice note, "rough draft" | NO |
| `#input/book` | Book | YES (temporary) |
| `#input/article` | Article | YES (temporary) |
| `#input/course` | Course | YES (temporary) |

**Note:** Literature Notes (`#input/book`, `#input/article`, `#input/course`) use the **Seeding → Incubation → Harvest** workflow for temporary flashcards.

---

## Detailed Description of Each Type

---

### 0. FLEETING NOTE (`#input/fleeting`)
**Title:** Timestamp or loose topic (e.g., `Quick thought 2025-01-05`)
**Flashcards:** NO

**Purpose:** Lightning-fast capture of a thought before it escapes. This is your brain's "inbox".

**Content:**
- Voice notes (transcriptions)
- Quick sketches on a napkin
- Screenshots to check later

**Rule:** Fleeting note is **EPHEMERAL**.
- After processing (Step 2), the note is deleted or archived
- It doesn't remain in the main graph as a knowledge node

---

### 1. ZETTEL (`#mind/zettel`)
**Title:** CLAIM/THESIS (full declarative sentence)
**Flashcards:** YES

**Content:**
- Continuous text developing the thesis from the title (synthesis, explaining "why")
- Links to other Zettels that support the claim
- "See also" with related Zettels
- Your own reflections, analogies, metaphors

**Example:** `serotonin inhibits dopamine release.md`
```markdown
---
tags: ["#mind/zettel"]
source: [["nawykologia (course)"]]
---

High [[serotonin]] can inhibit [[dopamine]] firing.
That is why if you're truly happy, you don't need anything 'special'.

See also:
- [[vta is responsible for our desires]]
```

---

### 2. APPLICATION (`#mind/application`)
**Title:** CONCLUSION FROM ACTION (full sentence about your experience)
**Flashcards:** YES

**Purpose:** Empirical proof (Case Study). Answer to the question: "Does this work for me?".

**Content:**
- Context of the situation
- Result (what happened)
- Link to Zettel (theory that explains it)

**Example:** `cold shower in the morning eliminated need for coffee.md`
```markdown
---
tags: ["#mind/application"]
date: [[2025-01-04]]
---

I replaced my morning coffee with 3 minutes of cold water.
Effect: Stable energy until 2pm, no crash.

This confirms:
- [[cold water stimulates dopamine release]]
```

---

### 3. PROTOCOL (`#mind/protocol`)
**Title:** "How to...?" (ideal solution)
**Flashcards:** YES

**Purpose:** Concrete procedure/algorithm for action.

**Difference from Zettel/Application:**
- Zettel = Theory/Fact
- Application = One-time proof
- Protocol = Repeatable instruction (set of steps)

**Content:**
- Numbered steps
- Links to Zettels that justify each step

**Example:** `how to change habit?.md`
```markdown
---
tags: ["#mind/protocol"]
source: [["nawykologia (course)"]]
---

1. Formulate proper habits. [[new habits should adhere to our identity]]
2. Start paying attention to thoughts and behaviors.
3. ...
```

---

### 4. QUESTION (`#mind/question`)
**Title:** QUESTION (ends with "?")
**Flashcards:** NO (no answer yet!)

**Purpose:** Open loop. A question you're seeking an answer to.

**Workflow:**
1. Create Question
2. Gather information (Incubator)
3. Find answer → Create Zettel → Link Zettel to Question

**Example:** `why do i feel aversion to effort?.md`
```markdown
---
tags: ["#mind/question"]
created: "[[2025-12-20]]"
---

* Cannot learn language actively, feel a wall.
* Cannot go exercise, always find excuse.
```

---

### 5. HUB (`#mind/hub`)
**Title:** Topic for exploration
**Flashcards:** NO

**Purpose:** Entry point to "trains of thought". Map of existing knowledge.

**Difference from Structure:**
- Hub = Map of terrain ("What do I already know?")
- Structure = Construction plan ("What do I want to create?")

**Content:**
- Links to BEGINNINGS of thought threads
- Grouping by categories

**Example:** `how to build proper understanding?.md`
```markdown
---
tags: ["#mind/hub"]
---

How does understanding work?
* [[environment without distractions promotes deep understanding]]
* [[using our words is more important for brain than copying]]

Techniques:
* [[feynman technique]]
* [[using martian approach enhance understanding]]
```

---

### 6. STRUCTURE (`#mind/structure`)
**Title:** Topic for writing/organization
**Flashcards:** NO

**Purpose:** Sandbox for organizing ideas before creating output (article, video).

**Content:**
- Outline (sketch)
- Arrangement of Zettels in logical narrative sequence

**Example:** `article - how to change habit outline.md`
```markdown
---
tags: ["#mind/structure"]
---

## Intro
- Problem with habits...

## Main argument
1. [[new habits should adhere to our identity]]
   - Elaboration...
2. ...

## Conclusion
```

---

### 7. INDEX (`#mind/index`)
**Title:** Broad category
**Flashcards:** NO

**Purpose:** Empty connector/backlink. Only to group topics in the graph.

**Content:**
- Only YAML frontmatter + possibly automatic backlinks list

**Example:** `productivity.md`
```markdown
---
tags: ["#mind/index"]
aliases: [produktywność]
---
```

---

### 8. PERSON (`#mind/person`)
**Title:** Full name
**Flashcards:** NO

**Purpose:** Note about an author/expert.

**Content:**
- Who is this person?
- Main ideas (links to this author's Zettels)

**Example:** `richard feynman.md`
```markdown
---
tags: ["#mind/person"]
aliases: [Feynman]
---

> "If you think you understand quantum mechanics, you don't understand quantum mechanics"

Known for:
- [[feynman technique]]
```

---

### 9. LITERATURE NOTE (`#input/*`)
**Title:** Source title
**Tags:** `#input/book`, `#input/article`, `#input/course`
**Flashcards:** YES (temporary) - via Seeding → Incubation → Harvest workflow

**Purpose:** Archive. Capture of raw information from the source. Also serves as the starting point for the primary flashcard workflow.

**Content:**
- Quotes
- Raw notes
- Backlinks to terms
- Temporary flashcards (during incubation period)

---

## Gardening: What When Knowledge Changes? (Truth Update)

Knowledge is not static. What's true today may be wrong tomorrow.

**Rule:** Don't delete old notes (unless simple typos/errors). Preserve the history of thought evolution.

### Scenario: "Carbs at Night Make You Fat"

You have an old Zettel: `carbs at night cause weight gain.md`.
New research (and your understanding) indicates: `total calorie intake dictates weight loss.md`.

### Deprecation Protocol (Withdrawal):

**1. Create a NEW Zettel with new, correct knowledge:**
- Title: `total calorie intake dictates weight loss, not timing.md`
- Content: Description of new knowledge + sources

**2. Update the OLD Zettel** (`carbs at...`):
- Add a warning at the very top
- Add a link to the new note that "supersedes" this knowledge
- (Optionally) Add tag `#status/deprecated` or `#status/outdated`

**Example of OLD Zettel after update:**
```markdown
---
tags: ["#mind/zettel", "#status/deprecated"]
---

> [!WARNING] DEPRECATED / OUTDATED
> This knowledge has been updated. Current understanding of the topic is here:
> → [[total calorie intake dictates weight loss, not timing]]

(Here is the old content about carbs making you fat...)
```

### Why Do We Do This?

- **Historical context:** You see how your thinking evolved
- **Link safety:** If other notes linked to the "old truth", links won't break. Clicking them takes you to the old Zettel, but you immediately see the redirect to the new truth
- **Bloom (Evaluate):** The very process of deciding something is outdated and why is an act of evaluation (Evaluate) - the highest level of learning

---

## Workflow: From Source to Knowledge

### Key Approach: UNDERSTAND → REMEMBER → CREATE

**Why NOT classic Bloom (Remember → Understand):**
- Memorizing without understanding = waste of time
- First UNDERSTAND (through writing/elaboration), then RETAIN (flashcards)

---

### Step 1: CAPTURE (While reading / living)
```
Source / Thought → Literature Note / Fleeting Note
```

- **Fleeting Note:** Quick dump of thought (voice, text) "on the go"
- **Literature Note:** Notes made while consuming content

---

### Step 2: ELABORATE + CREATE (Learning Process)
```
Fleeting/Literature → Zettel / Application / Protocol
```

**This is ONE step - you learn BY creating notes!**

#### Primary Path for Literature Notes: Seeding → Incubation → Harvest

This is the **recommended workflow** for processing Literature Notes. Instead of treating temporary flashcards as an exception, they become the natural first step for new knowledge.

**The Three Phases:**

```
SEEDING              INCUBATION           HARVEST
  🌱                    ⏳                   🌾
Create raw          Review cards        Move mature cards
flashcards          via spaced          to permanent
from Literature     repetition          Zettels
Note                (build neural       (interval ≥ 21 days)
                    pathways)
```

**Phase 1: SEEDING (Day 0)**

Click "Seed Flashcards" on any Literature Note to create temporary flashcards:
- Don't worry about perfect structure
- Just capture what seems interesting
- Cards are automatically marked as temporary (yellow dot indicator)

**Phase 2: INCUBATION (Days 1-21+)**

Review these flashcards through spaced repetition:
- Neural pathways strengthen with each review
- You start seeing patterns and connections
- Your brain processes the material passively
- The maturity indicator shows progress (0-100%)

**Phase 3: HARVEST (When interval ≥ 21 days)**

When a card's FSRS interval reaches 21+ days, it's ready to harvest:
- The card has proven its value through successful reviews
- You now truly UNDERSTAND what's important
- Move the card to a permanent Zettel
- The card transforms from temporary to permanent knowledge

**Harvest Threshold: interval ≥ 21 days**
- Based on FSRS scheduling algorithm
- Cards reaching this interval have demonstrated strong retention
- Use the Harvest Dashboard to see all ready-to-harvest cards

**Why This Works:**
- Flashcards force active recall even before deep understanding
- Time + repetition = clarity on what matters
- Natural selection: only valuable cards survive to harvest
- You avoid the "blank page paralysis" of immediate processing
- The 21-day threshold ensures genuine learning, not just recognition

**UI Features:**
- **Seed Flashcards button**: Green button on Literature Notes
- **Yellow dot**: Indicates temporary cards during review
- **Gold dot**: Indicates cards ready to harvest (interval ≥ 21 days)
- **Maturity indicators**: Progress bars showing harvest readiness
- **Harvest Dashboard**: Overview of all temporary cards and their status
- **"Ready to Harvest" quick action**: Start a review session with only harvest-ready cards

1. Review Inbox (Fleeting Notes)
2. Ask questions: "What term is this about?", "Is this true?", "How does this relate to my life?"
3. Write in your own words (Feynman Technique)
4. Connect with existing knowledge
5. Delete Fleeting Note after processing

**Decision question:**
```
Is this information...
    │
    ├─ A thesis/mechanism? → Zettel
    ├─ My experience? → Application
    └─ A procedure? → Protocol
```

---

### Step 2b: INCUBATOR (For unknowns)

**Problem:** You encounter something interesting but don't know where it fits.
**Solution:** Tag `#review/later`.

**Cyclical review:**
- Once a week review `#review/later`
- Decision: Elaborate (understood) / Delete (irrelevant) / Keep (still waiting)

---

### Step 3: REVIEW & GARDENING (Retention and Maintenance)

- **Flashcards:** AI generates from Zettel, Application, Protocol
- **Spaced Repetition:** Regular reviews
- **Gardening:** When during review you notice an error or outdated knowledge → Apply the Deprecation Protocol

---

## Complete Workflow Visually:

```
┌─────────────────────────────────────────────────────────────────┐
│  INPUT: Sources, Thoughts, Voice                                │
│  → Creating Literature Note / Fleeting Note                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PROCESSING (Elaboration)                                       │
│  Review Literature/Fleeting → Decision                          │
└─────────────────────────────────────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Literature  │    │  Know it's       │    │  Don't know if   │
│  Note        │    │  important       │    │  important       │
│      │       │    │       │          │    │       │          │
│      ▼       │    │       ▼          │    │       ▼          │
│  SEEDING 🌱  │    │  ELABORATE +     │    │  INCUBATOR       │
│  Temporary   │    │  CREATE          │    │  #review/later   │
│  flashcards  │    │  Zettel          │    │  Return later    │
│      │       │    │  App/Protocol    │    └──────────────────┘
│      ▼       │    └──────────────────┘              │
│  INCUBATION  │              │                       │
│  ⏳ Review   │              │                       │
│  (spaced rep)│              │                       │
│      │       │              │                       │
│      ▼       │              │                       │
│  HARVEST 🌾  │              │                       │
│  interval≥21d│              │                       │
│  → Move to   │──────────────┘                       │
│  permanent   │                                      │
└──────────────┘                                      │
              │                                       │
              │         ┌─────────────────────────────┘
              ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. REVIEW & GARDENING                                          │
│     Flashcards + Truth Update (Deprecation of old theses)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decision Tree: What to Create?

```
I have information I want to process
    │
    ├─ Is it a THESIS/MECHANISM (how something works)?
    │   └─ YES → Zettel
    │
    ├─ Is it MY EXPERIENCE (case study)?
    │   └─ YES → Application
    │
    ├─ Is it a PROCEDURE (how to do something)?
    │   └─ YES → Protocol
    │
    ├─ Is it a QUESTION without an answer?
    │   └─ YES → Question
    │
    └─ Do I just need a backlink for a broad category?
            └─ Create Index
```

---

## Rules Solving Duplication (Single Source of Truth)

| Information Type | Where It LIVES | Example |
|------------------|----------------|---------|
| Raw quote | Literature Note | "Bailey writes..." |
| Quick thought | Fleeting Note | "Check if carbs make you fat" |
| Thesis/Mechanism | Zettel | `serotonin inhibits dopamine...` |
| Real-life proof | Application | `cold shower worked for me...` |
| Procedure | Protocol | `how to change habit...` |

**Rule:** Link, don't copy.
In a Zettel you write: "This supports [[other zettel]]", not redefine the idea.

---

## Mapping to Bloom's Taxonomy

```
BLOOM'S TAXONOMY              YOUR WORKFLOW
─────────────────────────────────────────────────────
6. CREATE                     Structure (writing), Protocol (new methods)
5. EVALUATE                   Gardening (deprecation), Application (assessment)
4. ANALYZE                    Zettel (relations), Hub (mapping)
─────────────────────────────────────────────────────
3. APPLY                      Protocol (how to use?), Application (usage)
2. UNDERSTAND                 Zettel (explanation)
─────────────────────────────────────────────────────
1. REMEMBER                   Flashcards + Spaced Repetition
```

---

## Summary

### All Note Types:

| Tag | Title | Purpose | Flashcards |
|-----|-------|---------|------------|
| `#input/fleeting` | Timestamp/topic | Quick thought (inbox) | NO |
| `#input/*` | Source title | Archive (book/article/course) | YES (temporary) |
| `#mind/zettel` | CLAIM (sentence) | Your thought/thesis | YES (permanent) |
| `#mind/application` | CONCLUSION (sentence) | Real-life proof/Case Study | YES (permanent) |
| `#mind/protocol` | "How to...?" | Ideal solution/procedure | YES (permanent) |
| `#mind/question` | QUESTION (?) | Unanswered question | NO |
| `#mind/hub` | Exploration topic | Entry point to threads | NO |
| `#mind/structure` | Writing topic | Sandbox for organization | NO |
| `#mind/index` | Broad category | Empty connector | NO |
| `#mind/person` | Full name | Person | NO |

### Workflow (UNDERSTAND → REMEMBER → CREATE):

1. **CAPTURE** - Fleeting Note / Literature Note (capture)
2. **ELABORATE + CREATE** - Zettel/Application/Protocol (learning through writing!)
   - **2a. SEEDING → INCUBATION → HARVEST** - Primary path for Literature Notes:
     - Seed temporary flashcards from Literature Notes
     - Review through spaced repetition (incubation)
     - Harvest mature cards (interval ≥ 21 days) to permanent notes
   - **2b. INCUBATOR** - `#review/later` for unknown unknowns
3. **REVIEW & GARDENING** - Flashcards (AI generates) + Spaced repetition + Deprecation Protocol

### Where Information Goes:

- **Is a THESIS/MECHANISM** → Zettel
- **Is MY EXPERIENCE** → Application
- **Is a PROCEDURE** → Protocol
- **Is a QUESTION** → Question
- **Context/quote** → stays in Literature Note
- **Quick thought** → Fleeting Note (then process or delete)

### Navigation and Organization:

- **Hub** - "Where are my notes about X?" (exploration)
- **Structure** - "How to organize this for an article?" (writing)
- **Index** - empty connector/backlink

### Gardening:

- Don't delete old Zettels - deprecate them
- Tag `#status/deprecated` + link to new truth
- Preserve the history of thought evolution

---

## Sources

- [Getting Started - Zettelkasten Method](https://zettelkasten.de/overview/)
- [Create Zettel from Reading Notes According to the Principle of Atomicity](https://zettelkasten.de/posts/create-zettel-from-reading-notes/)
- [From Fleeting Notes to Project Notes – Concepts of "How to Take Smart Notes"](https://zettelkasten.de/posts/concepts-sohnke-ahrens-explained/)
- [The Difference Between Hub Notes and Structure Notes Explained - Bob Doto](https://writing.bobdoto.computer/the-difference-between-hub-notes-and-structure-notes-explained/)
- [Introduction to the Zettelkasten Method](https://zettelkasten.de/introduction/)
- [Niklas Luhmann's Original Zettelkasten](https://www.ernestchiang.com/en/posts/2025/niklas-luhmann-original-zettelkasten-method/)
