import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";
import { effect } from "@preact/signals";
import { allCardsArray, archivedSourceUids, pluginSettings, } from "@true-recall/obsidian/services/reactive-card-store";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { State } from "ts-fsrs";
const DOT = " \u00B7 ";
export function aggregateCardsWithPresetLimits(cards, archived, progressByPreset, now = new Date()) {
    var _a, _b;
    const buckets = new Map();
    const seenCardIds = new Set();
    for (const { card, preset } of cards) {
        if (seenCardIds.has(card.id))
            continue;
        seenCardIds.add(card.id);
        if (!card.sourceNotePath)
            continue; // Keep StatusBar aligned with dashboard notes list
        if (archived.has((_a = card.sourceUid) !== null && _a !== void 0 ? _a : ""))
            continue;
        const fsrs = card.fsrs;
        if (fsrs.suspended ||
            (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)) {
            continue;
        }
        let bucket = buckets.get(preset.id);
        if (!bucket) {
            bucket = { preset, newRaw: 0, learning: 0, dueRaw: 0 };
            buckets.set(preset.id, bucket);
        }
        switch (fsrs.state) {
            case State.New:
                bucket.newRaw++;
                break;
            case State.Learning:
            case State.Relearning:
                bucket.learning++;
                break;
            case State.Review:
                if (new Date(fsrs.due) <= now)
                    bucket.dueRaw++;
                break;
        }
    }
    let totalNew = 0;
    let totalLearning = 0;
    let totalDue = 0;
    for (const bucket of buckets.values()) {
        const progress = (_b = progressByPreset.get(bucket.preset.name)) !== null && _b !== void 0 ? _b : {
            newStudied: 0,
            reviewsCompleted: 0,
        };
        const remainingNew = Math.max(0, bucket.preset.newCardsPerDay - progress.newStudied);
        const remainingReviews = Math.max(0, bucket.preset.reviewsPerDay - progress.reviewsCompleted);
        totalNew += Math.min(bucket.newRaw, remainingNew);
        totalDue += Math.min(bucket.dueRaw, remainingReviews);
        totalLearning += bucket.learning;
    }
    return { dueToday: totalDue, newCount: totalNew, learning: totalLearning };
}
export class StatusBarWidget {
    constructor(el, _flashcardManager, onClickDue, getEnabled = () => true, services) {
        this.el = el;
        this.onClickDue = onClickDue;
        this.getEnabled = getEnabled;
        this.services = services;
        this.disposer = null;
        this.el.addClass("true-recall-status-bar");
        // eslint-disable-next-line @obsidianmd/no-direct-style-mutation -- Obsidian status bar element requires imperative styling
        this.el.style.cursor = "pointer";
        this.el.addEventListener("click", this.onClickDue);
    }
    start() {
        this.disposer = effect(() => {
            void allCardsArray.value;
            void pluginSettings.value;
            void archivedSourceUids.value;
            this.render();
        });
    }
    render() {
        if (!this.getEnabled()) {
            this.el.empty();
            return;
        }
        const global = this.aggregateGlobal();
        const parts = [];
        if (global.newCount > 0) {
            parts.push({
                text: `${global.newCount} new`,
                cssVar: FSRS_COLORS.new.cssVar,
            });
        }
        if (global.learning > 0) {
            parts.push({
                text: `${global.learning} lrn`,
                cssVar: FSRS_COLORS.learning.cssVar,
            });
        }
        if (global.dueToday > 0) {
            parts.push({
                text: `${global.dueToday} due`,
                cssVar: FSRS_COLORS.review.cssVar,
            });
        }
        this.el.empty();
        if (parts.length === 0) {
            this.el.createSpan({
                text: "\u2713 All done",
                cls: "true-recall-status-done",
            });
            return;
        }
        parts.forEach((part, i) => {
            if (i > 0) {
                this.el.createSpan({
                    text: DOT,
                    cls: "true-recall-status-dot",
                });
            }
            const span = this.el.createSpan({ text: part.text });
            span.style.setProperty("color", `var(${part.cssVar})`);
        });
    }
    aggregateGlobal() {
        if (!this.services)
            return this.aggregateRaw();
        const { presetService, sessionPersistence } = this.services;
        const archived = archivedSourceUids.value;
        const snapshot = computeActionableSessionSnapshot({
            allCards: allCardsArray.value,
            archivedSourceUids: archived,
            settings: pluginSettings.value,
            sessionPersistence,
            presetService,
        }, {});
        return {
            dueToday: snapshot.counts.due,
            newCount: snapshot.counts.new,
            learning: snapshot.counts.learning,
        };
    }
    /** Fallback when services not available */
    aggregateRaw() {
        var _a;
        const allCards = allCardsArray.value;
        const archived = archivedSourceUids.value;
        const now = new Date();
        let dueToday = 0;
        let newCount = 0;
        let learning = 0;
        for (const card of allCards) {
            if (!card.sourceNotePath)
                continue;
            if (archived.has((_a = card.sourceUid) !== null && _a !== void 0 ? _a : ""))
                continue;
            const fsrs = card.fsrs;
            if (fsrs.suspended ||
                (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now))
                continue;
            switch (fsrs.state) {
                case State.New:
                    newCount++;
                    break;
                case State.Learning:
                case State.Relearning:
                    learning++;
                    break;
                case State.Review:
                    if (new Date(fsrs.due) <= now)
                        dueToday++;
                    break;
            }
        }
        return { dueToday, newCount, learning };
    }
    dispose() {
        var _a;
        (_a = this.disposer) === null || _a === void 0 ? void 0 : _a.call(this);
        this.el.removeEventListener("click", this.onClickDue);
    }
}
