/**
 * Groups IO cards sharing the same image into a single panel entry.
 * Non-IO cards pass through as individual items.
 */
export function groupCards(cards, fsrsMap) {
    const items = [];
    const ioGroups = new Map();
    const consumedIds = new Set();
    for (const card of cards) {
        const fsrs = fsrsMap.get(card.id);
        if ((fsrs === null || fsrs === void 0 ? void 0 : fsrs.cardType) === "image-occlusion" &&
            fsrs.ioImagePath &&
            fsrs.ioRegionsJson) {
            const key = fsrs.ioImagePath;
            let group = ioGroups.get(key);
            if (!group) {
                group = { cards: [], fsrsCards: [] };
                ioGroups.set(key, group);
            }
            group.cards.push(card);
            group.fsrsCards.push(fsrs);
            consumedIds.add(card.id);
        }
    }
    for (const card of cards) {
        if (consumedIds.has(card.id)) {
            const fsrs = fsrsMap.get(card.id);
            if (!fsrs)
                continue;
            if (!fsrs.ioImagePath)
                continue;
            const key = fsrs.ioImagePath;
            const group = ioGroups.get(key);
            if (group) {
                group.fsrsCards.sort((a, b) => { var _a, _b; return ((_a = a.templateOrd) !== null && _a !== void 0 ? _a : 0) - ((_b = b.templateOrd) !== null && _b !== void 0 ? _b : 0); });
                items.push(Object.assign({ type: "io-group" }, group));
                ioGroups.delete(key);
            }
        }
        else {
            items.push({ type: "card", card });
        }
    }
    return items;
}
