import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback, useState } from "preact/hooks";
const btnCls = "ep:p-1.5 ep:rounded-md ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors ep:text-ui-smaller";
function CardItem({ card, onDelete, onOpen, onUnbury }) {
    var _a, _b;
    const question = ((_a = card.question) !== null && _a !== void 0 ? _a : "No question").slice(0, 100);
    const answer = ((_b = card.answer) !== null && _b !== void 0 ? _b : "No answer").slice(0, 80);
    return (_jsxs("div", { class: "ep:p-3 ep:border ep:border-obs-border ep:rounded-lg ep:bg-obs-secondary", children: [_jsx("div", { class: "ep:text-ui-small ep:text-obs-normal ep:mb-1", children: question }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: answer }), _jsxs("div", { class: "ep:flex ep:gap-2 ep:mt-2", children: [_jsx(Clickable, { class: btnCls, onClick: () => onOpen(card), children: "Open" }), onUnbury && (_jsx(Clickable, { class: btnCls, onClick: () => onUnbury(card), children: "Unbury" })), _jsx(Clickable, { class: btnCls, onClick: () => onDelete(card), children: "Delete" })] })] }));
}
export function CardPreviewBody({ initialCards, category, onDeleteCard, onOpenCard, onUnburyCard, onUnburyAll, onDeleteAll, onUpdateTitle, }) {
    const [cards, setCards] = useState(initialCards);
    const wrappedSetCards = useCallback((newCards) => {
        setCards(newCards);
        onUpdateTitle(`${newCards.length} cards`);
    }, [onUpdateTitle]);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:flex ep:justify-between ep:items-center ep:mb-4", children: [_jsxs("div", { class: "ep:text-ui-small ep:text-obs-muted", children: [cards.length, " cards"] }), category === "buried" && cards.length > 0 && (_jsx(Clickable, { class: "ep:text-ui-smaller ep:py-1.5 ep:px-3 ep:bg-obs-interactive ep:text-obs-on-accent ep:rounded-md ep:transition-colors ep:hover:opacity-90", onClick: () => onUnburyAll(cards, wrappedSetCards), children: "Unbury all" })), category === "suspended" && cards.length > 0 && (_jsx(Clickable, { class: "ep:text-ui-smaller ep:py-1.5 ep:px-3 ep:bg-obs-red ep:text-obs-on-accent ep:rounded-md ep:transition-colors ep:hover:opacity-90", onClick: () => onDeleteAll(cards, wrappedSetCards), children: "Delete all" }))] }), _jsx("div", { class: "ep:max-h-[60vh] ep:overflow-y-auto ep:flex ep:flex-col ep:gap-3", children: cards.length === 0 ? (_jsx("div", { class: "ep:text-center ep:text-obs-muted ep:py-8 ep:italic", children: "No cards in this category" })) : (cards.map((card) => (_jsx(CardItem, { card: card, onDelete: (c) => onDeleteCard(c, wrappedSetCards), onOpen: onOpenCard, onUnbury: category === "buried"
                        ? (c) => onUnburyCard(c, wrappedSetCards)
                        : undefined }, card.id)))) })] }));
}
