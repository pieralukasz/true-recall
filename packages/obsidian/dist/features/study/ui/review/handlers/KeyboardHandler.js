import { Rating } from "ts-fsrs";
export class KeyboardHandler {
    constructor(getReview, callbacks) {
        this.handleKeyDown = (e) => {
            if (this.isInputFocused(e.target))
                return;
            if ((e.metaKey || e.ctrlKey) && e.key === "z") {
                e.preventDefault();
                void this.callbacks.onUndo();
                return;
            }
            if (this.handleGlobalShortcuts(e))
                return;
            this.handleSessionShortcuts(e);
        };
        this.getReview = getReview;
        this.callbacks = callbacks;
    }
    isInputFocused(target) {
        if (target instanceof HTMLInputElement)
            return true;
        if (target instanceof HTMLTextAreaElement)
            return true;
        if (target instanceof HTMLElement && target.isContentEditable)
            return true;
        return false;
    }
    handleGlobalShortcuts(e) {
        const key = e.key;
        if (e.shiftKey && key === "!") {
            e.preventDefault();
            void this.callbacks.onSuspend();
            return true;
        }
        const handlers = {
            f: () => void this.callbacks.onForget(),
            F: () => void this.callbacks.onForget(),
            "-": () => void this.callbacks.onBuryCard(),
            "=": () => void this.callbacks.onBuryNote(),
            m: () => void this.callbacks.onMoveCard(),
            M: () => void this.callbacks.onMoveCard(),
            e: () => void this.callbacks.onEditCard(),
            E: () => void this.callbacks.onEditCard(),
            a: () => void this.callbacks.onAddCard(),
            A: () => void this.callbacks.onAddCard(),
            t: () => this.callbacks.onCycleTypeInMode(),
            T: () => this.callbacks.onCycleTypeInMode(),
        };
        const handler = handlers[key];
        if (handler) {
            e.preventDefault();
            handler();
            return true;
        }
        return false;
    }
    handleSessionShortcuts(e) {
        var _a, _b, _c, _d, _e, _f, _g;
        const review = this.getReview();
        if (!review.isActive || review.isComplete())
            return;
        if (!this.getReview().isAnswerRevealed) {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                this.callbacks.onShowAnswer();
                return;
            }
            if (e.code === "Space") {
                e.preventDefault();
                if ((_b = (_a = this.callbacks).isTypeInActive) === null || _b === void 0 ? void 0 : _b.call(_a)) {
                    (_d = (_c = this.callbacks).onFocusTypeIn) === null || _d === void 0 ? void 0 : _d.call(_c);
                }
                else {
                    this.callbacks.onShowAnswer();
                }
            }
        }
        else {
            const canRate = (_g = (_f = (_e = this.callbacks).canRateShortcuts) === null || _f === void 0 ? void 0 : _f.call(_e)) !== null && _g !== void 0 ? _g : true;
            if (!canRate) {
                if (["1", "2", "3", "4", " "].includes(e.key)) {
                    e.preventDefault();
                }
                return;
            }
            const ratingMap = {
                "1": Rating.Again,
                "2": Rating.Hard,
                "3": Rating.Good,
                " ": Rating.Good,
                "4": Rating.Easy,
            };
            const rating = ratingMap[e.key];
            if (rating !== undefined) {
                e.preventDefault();
                void this.callbacks.onAnswer(rating);
            }
        }
    }
    static getShortcutsHelp() {
        return [
            { key: "Space", description: "Reveal / Good rating" },
            { key: "Cmd/Ctrl+Enter", description: "Show answer (in input)" },
            { key: "1-4", description: "Rate: Again(1), Hard(2), Good(3), Easy(4)" },
            { key: "Cmd/Ctrl+Z", description: "Undo last action" },
            { key: "!", description: "Suspend card" },
            { key: "-", description: "Bury card until tomorrow" },
            { key: "=", description: "Bury note (all sibling cards)" },
            { key: "M", description: "Move card to another note" },
            { key: "A", description: "Add new flashcard" },
            { key: "E", description: "Edit card" },
            { key: "T", description: "Cycle type-in mode" },
        ];
    }
}
