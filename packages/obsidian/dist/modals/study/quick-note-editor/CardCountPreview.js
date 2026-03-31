import { jsxs as _jsxs } from "preact/jsx-runtime";
import { generateCardsForNote } from "@true-recall/core/services/cards/card-generation.service";
import { useMemo } from "preact/hooks";
export function CardCountPreview({ noteType, noteTypeId, fields, hasContent, }) {
    const cardCount = useMemo(() => {
        if (!hasContent)
            return 0;
        const draftNote = {
            id: "draft",
            noteTypeId,
            fields,
            tags: [],
        };
        return generateCardsForNote(draftNote, noteType).length;
    }, [noteType, noteTypeId, fields, hasContent]);
    if (!hasContent)
        return null;
    return (_jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: ["Will generate: ", cardCount, " card", cardCount !== 1 ? "s" : ""] }));
}
