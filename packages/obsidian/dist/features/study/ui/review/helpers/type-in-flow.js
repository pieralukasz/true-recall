export function deriveTypeInMode(typeInModeEnabled, aiEnabled) {
    if (!typeInModeEnabled)
        return "off";
    return aiEnabled ? "ai" : "diff";
}
export function nextTypeInMode(mode, skipOff = false) {
    if (mode === "off")
        return "ai";
    if (mode === "ai")
        return "diff";
    return skipOff ? "ai" : "off";
}
export function isTypeInRequiredForCard(card, typeInModeEnabled) {
    var _a;
    if (!card)
        return false;
    if (card.cardType === "image-occlusion")
        return false;
    if (!((_a = card.answer) === null || _a === void 0 ? void 0 : _a.trim()))
        return false;
    if (card.alwaysTypeIn || card.fsrs.alwaysTypeIn)
        return true;
    if (!typeInModeEnabled)
        return false;
    return true;
}
export function shouldRunAIGradingOnReveal(options) {
    if (!options.requiresTypeIn)
        return false;
    if (!options.aiEnabled)
        return false;
    if (options.isChecking)
        return false;
    return options.typedAnswer.trim().length > 0;
}
export function isRatingLockedForTypeIn(options) {
    if (!options.requiresTypeIn)
        return false;
    if (!options.isAnswerRevealed)
        return false;
    if (options.isChecking)
        return true;
    return false;
}
