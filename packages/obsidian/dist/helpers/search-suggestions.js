// ─── Static data (mirrors search-parser.ts exactly) ────────────
const STATE_VALUES = [
    "new",
    "learning",
    "review",
    "relearning",
    "suspended",
    "buried",
    "due",
    "overdue",
];
const STATE_DESCRIPTIONS = {
    new: "Unseen cards",
    learning: "Currently learning",
    review: "Due for review",
    relearning: "Failed and relearning",
    suspended: "Manually paused",
    buried: "Temporarily hidden",
    due: "Due now (review state)",
    overdue: "Past due date",
};
const PROP_VALUES = [
    { name: "s", aliases: ["stability"], description: "Stability (days)" },
    {
        name: "d",
        aliases: ["difficulty"],
        description: "Difficulty (0-1)",
    },
    {
        name: "r",
        aliases: ["retrievability"],
        description: "Retrievability (0-1)",
    },
    {
        name: "ivl",
        aliases: ["interval"],
        description: "Interval (days)",
    },
    { name: "reps", aliases: [], description: "Review count" },
    { name: "lapses", aliases: [], description: "Lapse count" },
];
const TYPE_VALUES = ["basic", "cloze", "reversed", "image-occlusion"];
const VIA_VALUES = [
    { value: "ai", description: "AI-generated" },
    { value: "manual", description: "Manually created" },
    { value: "anki_import", description: "Imported from Anki" },
];
const TOP_LEVEL_PREFIXES = [
    { prefix: "is:", category: "state", description: "Filter by card state" },
    {
        prefix: "prop:",
        category: "property",
        description: "Filter by property value",
    },
    {
        prefix: "note:",
        category: "note",
        description: "Filter by source note",
    },
    {
        prefix: "project:",
        category: "project",
        description: "Filter by project",
    },
    {
        prefix: "preset:",
        category: "preset",
        description: "Filter by FSRS preset",
    },
    {
        prefix: "type:",
        category: "type",
        description: "Filter by card type",
    },
    {
        prefix: "via:",
        category: "via",
        description: "Filter by creation method",
    },
    {
        prefix: "added:",
        category: "date",
        description: "Created in last N days",
    },
    {
        prefix: "reviewed:",
        category: "date",
        description: "Reviewed in last N days",
    },
];
// ─── Token extraction ───────────────────────────────────────────
export function getTokenAtCursor(input, cursorPos) {
    if (!input || cursorPos < 0) {
        return { token: "", start: 0, end: 0 };
    }
    const pos = Math.min(cursorPos, input.length);
    // Walk backward from cursor to find token start
    let start = pos;
    let inQuote = false;
    let quoteChar = "";
    // First scan forward from the start to determine quote state at cursor
    for (let i = 0; i < pos; i++) {
        const ch = input[i];
        if (inQuote) {
            if (ch === quoteChar)
                inQuote = false;
        }
        else if (ch === '"' || ch === "'") {
            inQuote = true;
            quoteChar = ch;
        }
    }
    // If we're inside a quoted string, walk back to the beginning of the
    // prefixed token (e.g. note:"Biol|ogy" → start at 'n')
    if (inQuote) {
        // Find the opening quote
        let quoteStart = pos - 1;
        while (quoteStart >= 0 && input[quoteStart] !== quoteChar) {
            quoteStart--;
        }
        // Now walk further back past any prefix (note:, project:, etc.)
        start = quoteStart;
        while (start > 0 && input[start - 1] !== " " && input[start - 1] !== "\t") {
            start--;
        }
        // Walk forward to find closing quote or end
        let end = pos;
        while (end < input.length && input[end] !== quoteChar) {
            end++;
        }
        if (end < input.length)
            end++; // include closing quote
        return { token: input.slice(start, end), start, end };
    }
    // Not in a quote — walk backward to whitespace
    start = pos;
    while (start > 0 && input[start - 1] !== " " && input[start - 1] !== "\t") {
        start--;
    }
    // Walk forward to whitespace
    let end = pos;
    while (end < input.length && input[end] !== " " && input[end] !== "\t") {
        end++;
    }
    return { token: input.slice(start, end), start, end };
}
// ─── Token context parsing ──────────────────────────────────────
export function getTokenContext(tokenInfo) {
    const { token, start, end } = tokenInfo;
    if (!token) {
        return {
            type: "prefix",
            partial: "",
            negated: false,
            fullToken: "",
            start,
            end,
        };
    }
    const negated = token.startsWith("-");
    const raw = negated ? token.slice(1) : token;
    const colonIdx = raw.indexOf(":");
    if (colonIdx === -1) {
        // No colon — user is typing a prefix name or plain text
        return {
            type: "prefix",
            partial: raw.toLowerCase(),
            negated,
            fullToken: token,
            start,
            end,
        };
    }
    const prefix = raw.slice(0, colonIdx).toLowerCase();
    const afterColon = raw.slice(colonIdx + 1);
    // Strip quotes from the partial value
    const partial = afterColon.replace(/^["']|["']$/g, "");
    const prefixMap = {
        is: "is",
        prop: "prop",
        note: "note",
        project: "project",
        preset: "preset",
        type: "type",
        via: "via",
        added: "date",
        reviewed: "date",
    };
    const contextType = prefixMap[prefix];
    if (contextType) {
        return {
            type: contextType,
            partial: partial.toLowerCase(),
            negated,
            fullToken: token,
            start,
            end,
        };
    }
    // Unknown prefix — treat as text
    return {
        type: "text",
        partial: raw.toLowerCase(),
        negated,
        fullToken: token,
        start,
        end,
    };
}
// ─── Static suggestion builders ─────────────────────────────────
export function buildStaticSuggestions(context) {
    switch (context.type) {
        case "prefix":
            return buildPrefixSuggestions(context.partial, context.negated);
        case "is":
            return buildStateSuggestions(context.partial, context.negated);
        case "prop":
            return buildPropSuggestions(context.partial);
        case "type":
            return buildTypeSuggestions(context.partial);
        case "via":
            return buildViaSuggestions(context.partial);
        case "date":
            return buildDateSuggestions(context);
        // note, project, preset are dynamic — handled by the provider
        default:
            return [];
    }
}
function buildPrefixSuggestions(partial, negated) {
    const neg = negated ? "-" : "";
    return TOP_LEVEL_PREFIXES.filter((p) => p.prefix.startsWith(partial)).map((p) => ({
        id: `prefix-${neg}${p.prefix}`,
        label: `${neg}${p.prefix}`,
        insertText: `${neg}${p.prefix}`,
        category: "keyword",
        description: p.description,
    }));
}
function buildStateSuggestions(partial, negated) {
    const neg = negated ? "-" : "";
    return STATE_VALUES.filter((s) => s.startsWith(partial)).map((s) => ({
        id: `state-${neg}${s}`,
        label: `${neg}is:${s}`,
        insertText: `${neg}is:${s}`,
        category: "state",
        description: STATE_DESCRIPTIONS[s],
    }));
}
function buildPropSuggestions(partial) {
    const suggestions = [];
    for (const prop of PROP_VALUES) {
        const allNames = [prop.name, ...prop.aliases];
        const matches = allNames.some((name) => name.startsWith(partial));
        if (!matches && partial)
            continue;
        suggestions.push({
            id: `prop-${prop.name}`,
            label: `prop:${prop.name}>`,
            insertText: `prop:${prop.name}>`,
            category: "property",
            description: prop.description,
        });
    }
    return suggestions;
}
function buildTypeSuggestions(partial) {
    return TYPE_VALUES.filter((t) => t.startsWith(partial)).map((t) => ({
        id: `type-${t}`,
        label: `type:${t}`,
        insertText: `type:${t}`,
        category: "type",
        description: `${t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ")} cards`,
    }));
}
function buildViaSuggestions(partial) {
    return VIA_VALUES.filter((v) => v.value.startsWith(partial)).map((v) => ({
        id: `via-${v.value}`,
        label: `via:${v.value}`,
        insertText: `via:${v.value}`,
        category: "via",
        description: v.description,
    }));
}
function buildDateSuggestions(context) {
    // Suggest common day ranges for added: and reviewed:
    const prefix = context.fullToken.startsWith("-")
        ? context.fullToken.slice(1).split(":")[0]
        : context.fullToken.split(":")[0];
    if (prefix !== "added" && prefix !== "reviewed")
        return [];
    const dayOptions = [1, 3, 7, 14, 30, 90];
    return dayOptions.map((d) => ({
        id: `date-${prefix}-${d}`,
        label: `${prefix}:${d}`,
        insertText: `${prefix}:${d}`,
        category: "date",
        description: `Last ${d} day${d > 1 ? "s" : ""}`,
    }));
}
// ─── Token replacement ──────────────────────────────────────────
export function replaceTokenAtCursor(input, cursorPos, replacement) {
    const tokenInfo = getTokenAtCursor(input, cursorPos);
    const before = input.slice(0, tokenInfo.start);
    const after = input.slice(tokenInfo.end);
    // Add a trailing space if there isn't one already after the replacement
    const needsSpace = after.length > 0 && after[0] !== " ";
    const spacer = needsSpace ? " " : after.length === 0 ? " " : "";
    const text = before + replacement + spacer + after;
    const cursor = before.length + replacement.length + spacer.length;
    return { text, cursor };
}
