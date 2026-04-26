export const GENERATION_LANGUAGES = [
    { value: "auto", label: "Auto-detect (match source text)" },
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "pt", label: "Portuguese" },
    { value: "nl", label: "Dutch" },
    { value: "ru", label: "Russian" },
    { value: "uk", label: "Ukrainian" },
    { value: "pl", label: "Polish" },
    { value: "cs", label: "Czech" },
    { value: "tr", label: "Turkish" },
    { value: "ar", label: "Arabic" },
    { value: "hi", label: "Hindi" },
    { value: "ja", label: "Japanese" },
    { value: "zh-CN", label: "Chinese (Simplified)" },
    { value: "zh-TW", label: "Chinese (Traditional)" },
    { value: "ko", label: "Korean" },
    { value: "vi", label: "Vietnamese" },
    { value: "th", label: "Thai" },
    { value: "id", label: "Indonesian" },
    { value: "sv", label: "Swedish" },
    { value: "no", label: "Norwegian" },
    { value: "da", label: "Danish" },
    { value: "fi", label: "Finnish" },
    { value: "el", label: "Greek" },
    { value: "ro", label: "Romanian" },
    { value: "hu", label: "Hungarian" },
    { value: "he", label: "Hebrew" },
];
export function resolveLanguageName(code) {
    var _a, _b;
    return (_b = (_a = GENERATION_LANGUAGES.find((l) => l.value === code)) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : code;
}
export function buildLanguageSuffix(languageCode) {
    var _a, _b;
    if (languageCode === "auto")
        return "";
    const label = (_b = (_a = GENERATION_LANGUAGES.find((l) => l.value === languageCode)) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : languageCode;
    return `\n\nLANGUAGE: Generate ALL flashcard content (questions, answers, cloze text) in ${label}. This overrides any other language instructions.`;
}
