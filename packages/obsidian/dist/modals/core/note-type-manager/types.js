export function createDefaultDraft() {
    return {
        name: "",
        type: 0,
        fields: ["Front", "Back"],
        templates: [
            {
                name: "Card 1",
                ordinal: 0,
                qfmt: "{{Front}}",
                afmt: "{{Back}}",
            },
        ],
        css: "",
    };
}
