import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { State } from "ts-fsrs";
export function computeProjectStats(projectPath, projectName, childCount, hierarchyService, cardStore, fsrsService, context) {
    var _a, _b, _c, _d, _e, _f, _g;
    const sourceUids = (_a = context === null || context === void 0 ? void 0 : context.sourceUids) !== null && _a !== void 0 ? _a : hierarchyService.getSourceUidsForProject(projectPath);
    const now = (_b = context === null || context === void 0 ? void 0 : context.now) !== null && _b !== void 0 ? _b : new Date();
    let totalCards = 0;
    let due = 0;
    let newCount = 0;
    let learning = 0;
    let retrievabilitySum = 0;
    let reviewCardCount = 0;
    let lastReviewed = null;
    for (const uid of sourceUids) {
        const cards = (_f = (_d = (_c = context === null || context === void 0 ? void 0 : context.cardsBySourceUid) === null || _c === void 0 ? void 0 : _c.get(uid)) !== null && _d !== void 0 ? _d : (_e = cardStore.getCardsBySourceUid) === null || _e === void 0 ? void 0 : _e.call(cardStore, uid)) !== null && _f !== void 0 ? _f : [];
        for (const card of cards) {
            totalCards++;
            if (card.suspended)
                continue;
            if (card.buriedUntil && new Date(card.buriedUntil) > now)
                continue;
            switch (card.state) {
                case State.New:
                    newCount++;
                    break;
                case State.Learning:
                case State.Relearning:
                    learning++;
                    break;
                case State.Review:
                    if (new Date(card.due) <= now)
                        due++;
                    break;
            }
            // Health: avg retrievability of non-new cards
            if (card.state !== State.New) {
                const cachedRetrievability = (_g = context === null || context === void 0 ? void 0 : context.retrievabilityByCardId) === null || _g === void 0 ? void 0 : _g.get(card.id);
                retrievabilitySum +=
                    cachedRetrievability !== null && cachedRetrievability !== void 0 ? cachedRetrievability : fsrsService.getRetrievability(card, now);
                reviewCardCount++;
            }
            if (card.lastReview &&
                (!lastReviewed || card.lastReview > lastReviewed)) {
                lastReviewed = card.lastReview;
            }
        }
    }
    const healthPct = reviewCardCount > 0
        ? Math.round((retrievabilitySum / reviewCardCount) * 100)
        : 0;
    return {
        name: projectName,
        path: projectPath,
        totalCards,
        due,
        newCount,
        learning,
        healthPct,
        childCount,
        lastReviewed,
    };
}
export function healthColor(pct) {
    if (pct >= 80)
        return `var(${FSRS_COLORS.new.cssVar})`;
    if (pct >= 50)
        return `var(${FSRS_COLORS.learning.cssVar})`;
    return `var(${FSRS_COLORS.suspended.cssVar})`;
}
