import { signal } from "@preact/signals";
import { refreshCards, removeCard, removeCards, updateCard, } from "@true-recall/obsidian/services/reactive-card-store";
const CARD_MUTATION_ACTION_ALIASES = {
    delete: "removed",
};
const CARD_MUTATION_ACTION_SET = new Set([
    "added",
    "removed",
    "reset",
    "update",
    "reschedule",
    "suspend",
    "unsuspend",
]);
export const CARD_MUTATION_ACTION_SEMANTICS = {
    added: "queue-sync",
    removed: "queue-remove",
    reset: "queue-sync",
    update: "queue-sync",
    reschedule: "queue-sync",
    suspend: "queue-sync",
    unsuspend: "queue-sync",
};
const _lastMutation = signal(null);
export const lastMutation = _lastMutation;
export function normalizeCardMutationAction(action) {
    if (!action)
        return undefined;
    if (CARD_MUTATION_ACTION_SET.has(action)) {
        return action;
    }
    return CARD_MUTATION_ACTION_ALIASES[action];
}
export function getNormalizedCardMutationAction(mutation) {
    const normalizedAction = normalizeCardMutationAction(mutation.action);
    if (normalizedAction)
        return normalizedAction;
    switch (mutation.type) {
        case "added":
            return "added";
        case "updated":
            return "update";
        case "removed":
            return "removed";
        case "bulk":
            return "update";
        default:
            return undefined;
    }
}
function applyIncrementalUpdate(mutation) {
    switch (mutation.type) {
        case "added":
        case "updated":
        case "reviewed":
            if (mutation.cardId) {
                updateCard(mutation.cardId);
            }
            else {
                refreshCards();
            }
            break;
        case "removed":
            if (mutation.cardId) {
                removeCard(mutation.cardId);
            }
            else if (mutation.cardIds) {
                removeCards(mutation.cardIds);
            }
            else {
                refreshCards();
            }
            break;
        case "bulk":
            if (mutation.cardIds && mutation.action === "removed") {
                removeCards(mutation.cardIds);
            }
            else if (mutation.cardIds) {
                for (const id of mutation.cardIds)
                    updateCard(id);
            }
            else {
                refreshCards();
            }
            break;
        default:
            refreshCards();
    }
}
let reviewRefreshTimer = null;
const REVIEW_REFRESH_DELAY_MS = 300;
export function notifyCardChange(mutation) {
    const normalizedAction = normalizeCardMutationAction(mutation.action);
    const normalizedMutation = normalizedAction && normalizedAction !== mutation.action
        ? Object.assign(Object.assign({}, mutation), { action: normalizedAction }) : mutation;
    // Set lastMutation first (consumers like ReviewView listen to this)
    _lastMutation.value = normalizedMutation;
    // Apply incremental card index update OUTSIDE the mutation signal
    // to avoid "Cycle detected" when computed signals cascade.
    if (normalizedMutation.type !== "reviewed") {
        if (reviewRefreshTimer) {
            clearTimeout(reviewRefreshTimer);
            reviewRefreshTimer = null;
        }
        applyIncrementalUpdate(normalizedMutation);
    }
    else {
        // Debounced incremental refresh for "reviewed" so dashboard / panel
        // header updates after rapid answering pauses.
        if (reviewRefreshTimer)
            clearTimeout(reviewRefreshTimer);
        reviewRefreshTimer = setTimeout(() => {
            reviewRefreshTimer = null;
            applyIncrementalUpdate(normalizedMutation);
        }, REVIEW_REFRESH_DELAY_MS);
    }
}
const _highlightRequest = signal(null);
export const highlightRequest = _highlightRequest;
let highlightCounter = 0;
export function requestSourceHighlight(sourceNotePath, sourceText, mode = "jump", colorHint) {
    _highlightRequest.value = {
        sourceNotePath,
        sourceText,
        requestId: ++highlightCounter,
        mode,
        colorHint,
    };
}
export function clearSourceHighlight() {
    _highlightRequest.value = null;
}
