import { type FilterState } from "@true-recall/core/types/browser.types";
/**
 * Parse a search query string into a structured FilterState.
 *
 * Supported tokens:
 * - is:new, is:learning, is:review, is:relearning, is:suspended, is:buried
 * - is:due, is:overdue (maps to state filters)
 * - -is:suspended (negation)
 * - prop:s>21, prop:d<0.5, prop:reps>=10
 * - note:"Biology", project:"Med School", preset:"Hard Mode"
 * - type:cloze, type:basic, type:reversed, type:image-occlusion
 * - via:ai, via:manual, via:anki_import
 * - added:7, reviewed:30
 * - "exact phrase" or plain text
 */
export declare function parseSearchQuery(input: string): FilterState;
