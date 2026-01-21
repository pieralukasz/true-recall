/**
 * Browser Search Parser
 * Parses Anki-style search queries into tokens
 *
 * Supported syntax:
 * - word: Full-text search in question/answer
 * - is:new, is:learning, is:review, is:due, is:suspended, is:buried
 * - source:xxx: Filter by source note name
 * - project:xxx: Filter by project
 * - prop:stability>10, prop:lapses>3, etc.
 * - created:7: Created in last N days
 * - -xxx: Negation (prefix for any token)
 * - "phrase search": Exact phrase matching
 */
import type { SearchToken } from "../../types/browser.types";

/**
 * Parse a search query string into tokens
 */
export function parseSearchQuery(query: string): SearchToken[] {
    const tokens: SearchToken[] = [];
    const trimmed = query.trim();
    if (!trimmed) return tokens;

    // Tokenize the query, respecting quoted strings
    const rawTokens = tokenize(trimmed);

    for (const raw of rawTokens) {
        const token = parseToken(raw);
        if (token) {
            tokens.push(token);
        }
    }

    return tokens;
}

/**
 * Split query into tokens, respecting quoted strings
 */
function tokenize(query: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < query.length; i++) {
        const char = query[i]!;

        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            current += char;
        } else if (char === quoteChar && inQuotes) {
            inQuotes = false;
            current += char;
            quoteChar = "";
        } else if (char === " " && !inQuotes) {
            if (current.trim()) {
                tokens.push(current.trim());
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        tokens.push(current.trim());
    }

    return tokens;
}

/**
 * Parse a single token string into a SearchToken
 */
function parseToken(raw: string): SearchToken | null {
    if (!raw) return null;

    // Check for negation prefix
    let negated = false;
    let value = raw;
    if (value.startsWith("-") && value.length > 1) {
        negated = true;
        value = value.slice(1);
    }

    // Check for quoted string (exact phrase)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return {
            type: "text",
            value: value.slice(1, -1),
            negated,
        };
    }

    // Check for prefix operators
    const colonIndex = value.indexOf(":");
    if (colonIndex > 0) {
        const prefix = value.slice(0, colonIndex).toLowerCase();
        const rest = value.slice(colonIndex + 1);

        switch (prefix) {
            case "is":
                return {
                    type: "is",
                    value: rest,
                    negated,
                };

            case "source":
                return {
                    type: "source",
                    value: rest,
                    negated,
                };

            case "project":
                return {
                    type: "project",
                    value: rest,
                    negated,
                };

            case "created":
                return {
                    type: "created",
                    value: rest,
                    negated,
                };

            case "prop":
                return parsePropToken(rest, negated);
        }
    }

    // Plain text search
    return {
        type: "text",
        value,
        negated,
    };
}

/**
 * Parse a prop: token (e.g., "stability>10")
 */
function parsePropToken(value: string, negated: boolean): SearchToken | null {
    // Match patterns like "stability>10", "lapses>=3", "difficulty=5"
    const match = value.match(/^(\w+)(<=|>=|<|>|=)(\d+(?:\.\d+)?)$/);
    if (!match) return null;

    const [, property, operator, numericStr] = match;
    const numericValue = parseFloat(numericStr!);

    if (isNaN(numericValue)) return null;

    return {
        type: "prop",
        value,
        negated,
        property: property!.toLowerCase(),
        operator: operator as "<" | ">" | "=" | "<=" | ">=",
        numericValue,
    };
}

/**
 * Validate a search query and return any errors
 */
export function validateSearchQuery(query: string): string[] {
    const errors: string[] = [];
    const tokens = parseSearchQuery(query);

    for (const token of tokens) {
        if (token.type === "is") {
            const validValues = ["new", "learning", "review", "due", "suspended", "buried"];
            if (!validValues.includes(token.value.toLowerCase())) {
                errors.push(`Unknown "is:" value: ${token.value}. Valid: ${validValues.join(", ")}`);
            }
        }

        if (token.type === "prop" && !token.property) {
            errors.push(`Invalid prop: syntax. Use format like "prop:stability>10"`);
        }
    }

    return errors;
}

/**
 * Format tokens back into a query string (for display/editing)
 */
export function formatSearchQuery(tokens: SearchToken[]): string {
    return tokens.map(token => {
        const prefix = token.negated ? "-" : "";

        switch (token.type) {
            case "text":
                // Add quotes if value contains spaces
                if (token.value.includes(" ")) {
                    return `${prefix}"${token.value}"`;
                }
                return `${prefix}${token.value}`;

            case "is":
                return `${prefix}is:${token.value}`;

            case "source":
                return `${prefix}source:${token.value}`;

            case "project":
                return `${prefix}project:${token.value}`;

            case "created":
                return `${prefix}created:${token.value}`;

            case "prop":
                return `${prefix}prop:${token.property}${token.operator}${token.numericValue}`;

            default:
                return "";
        }
    }).filter(Boolean).join(" ");
}

/**
 * Get search suggestions based on current query position
 */
export function getSearchSuggestions(
    query: string,
    cursorPosition: number,
    availableProjects: string[],
    availableSources: string[]
): string[] {
    const suggestions: string[] = [];

    // Get the current token being typed
    const beforeCursor = query.slice(0, cursorPosition);
    const lastSpace = beforeCursor.lastIndexOf(" ");
    const currentToken = beforeCursor.slice(lastSpace + 1);

    if (!currentToken) {
        // Show all prefix suggestions
        return ["is:", "source:", "project:", "prop:", "created:"];
    }

    // If typing a prefix
    if (currentToken.startsWith("is:")) {
        const partial = currentToken.slice(3).toLowerCase();
        const options = ["new", "learning", "review", "due", "suspended", "buried"];
        return options
            .filter(o => o.startsWith(partial))
            .map(o => `is:${o}`);
    }

    if (currentToken.startsWith("project:")) {
        const partial = currentToken.slice(8).toLowerCase();
        return availableProjects
            .filter(p => p.toLowerCase().startsWith(partial))
            .map(p => `project:${p}`)
            .slice(0, 10);
    }

    if (currentToken.startsWith("source:")) {
        const partial = currentToken.slice(7).toLowerCase();
        return availableSources
            .filter(s => s.toLowerCase().startsWith(partial))
            .map(s => `source:${s}`)
            .slice(0, 10);
    }

    if (currentToken.startsWith("prop:")) {
        const partial = currentToken.slice(5).toLowerCase();
        const props = ["stability", "difficulty", "lapses", "reps", "interval"];
        return props
            .filter(p => p.startsWith(partial))
            .map(p => `prop:${p}>`);
    }

    // Suggest prefixes if typing something that looks like it could be a prefix
    const prefixes = ["is:", "source:", "project:", "prop:", "created:"];
    const matchingPrefixes = prefixes.filter(p => p.startsWith(currentToken.toLowerCase()));
    if (matchingPrefixes.length > 0) {
        suggestions.push(...matchingPrefixes);
    }

    return suggestions;
}
