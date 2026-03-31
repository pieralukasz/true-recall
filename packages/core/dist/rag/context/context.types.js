export function contextKey(item) {
    return item.kind.includes("note")
        ? item.path
        : item.cardId;
}
