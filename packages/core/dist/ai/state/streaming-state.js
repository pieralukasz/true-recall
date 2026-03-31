const INITIAL_STATE = {
    isGenerating: false,
    phase: "idle",
    noteName: null,
    notePath: null,
    completedCards: [],
    recentCardIds: new Set(),
    partialQuestion: null,
    partialAnswer: null,
    error: null,
    abortController: null,
    totalChunks: null,
    completedChunks: 0,
    currentChunkLabel: null,
};
/** Simple observable state container (platform-agnostic replacement for @preact/signals). */
class StreamingStateStore {
    constructor() {
        this._value = Object.assign(Object.assign({}, INITIAL_STATE), { recentCardIds: new Set() });
        this.listeners = new Set();
    }
    get value() {
        return this._value;
    }
    set value(newState) {
        this._value = newState;
        for (const listener of this.listeners) {
            listener(newState);
        }
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
export const streamingGeneration = new StreamingStateStore();
export function startStreaming(noteName, notePath, abortController, totalChunks) {
    streamingGeneration.value = Object.assign(Object.assign({}, INITIAL_STATE), { recentCardIds: new Set(), isGenerating: true, phase: "waiting", noteName,
        notePath,
        abortController, totalChunks: totalChunks !== null && totalChunks !== void 0 ? totalChunks : null });
}
export function addStreamedCard(card) {
    const current = streamingGeneration.value;
    const newRecentIds = new Set(current.recentCardIds);
    newRecentIds.add(card.id);
    streamingGeneration.value = Object.assign(Object.assign({}, current), { completedCards: [...current.completedCards, card], recentCardIds: newRecentIds });
}
export function updatePartial(question, answer) {
    const current = streamingGeneration.value;
    streamingGeneration.value = Object.assign(Object.assign({}, current), { phase: current.phase === "waiting" ? "streaming" : current.phase, partialQuestion: question, partialAnswer: answer });
}
export function updateChunkProgress(completedChunks, currentChunkLabel) {
    const current = streamingGeneration.value;
    streamingGeneration.value = Object.assign(Object.assign({}, current), { completedChunks,
        currentChunkLabel });
}
export function finishStreaming(error) {
    const current = streamingGeneration.value;
    streamingGeneration.value = Object.assign(Object.assign({}, INITIAL_STATE), { recentCardIds: current.recentCardIds, error: error !== null && error !== void 0 ? error : null });
}
export function clearRecentCards() {
    streamingGeneration.value = Object.assign(Object.assign({}, streamingGeneration.value), { recentCardIds: new Set() });
}
export function cancelStreaming() {
    var _a;
    const current = streamingGeneration.value;
    (_a = current.abortController) === null || _a === void 0 ? void 0 : _a.abort();
    streamingGeneration.value = Object.assign(Object.assign({}, INITIAL_STATE), { recentCardIds: new Set() });
}
/**
 * Default scheduler: uses requestAnimationFrame if available, else setTimeout.
 */
const defaultSchedule = typeof requestAnimationFrame !== "undefined"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16);
export function createThrottledPartialUpdater(schedule = defaultSchedule) {
    let pendingQuestion = null;
    let pendingAnswer = null;
    let scheduled = false;
    return (question, answer) => {
        pendingQuestion = question;
        pendingAnswer = answer;
        if (!scheduled) {
            scheduled = true;
            schedule(() => {
                updatePartial(pendingQuestion, pendingAnswer);
                scheduled = false;
            });
        }
    };
}
