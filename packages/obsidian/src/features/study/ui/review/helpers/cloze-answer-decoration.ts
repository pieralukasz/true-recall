import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

/** Replace the revealed-cloze ranges (offsets in the new document). */
export const setClozeAnswerRanges =
	StateEffect.define<readonly [number, number][]>();

const clozeAnswerMark = Decoration.mark({ class: "cloze tr-cloze" });

/**
 * Marks the revealed cloze in the review editor. Anki's `cloze` class lets
 * CSS snippets and note type Styling (including CSS imported from Anki
 * decks) restyle it; `tr-cloze` carries the default background tint applied
 * in review.styles.css.
 */
export const clozeAnswerField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(decorations, tr) {
		let next = decorations.map(tr.changes);
		for (const effect of tr.effects) {
			if (!effect.is(setClozeAnswerRanges)) continue;
			const length = tr.state.doc.length;
			next = Decoration.set(
				effect.value
					.filter(([from, to]) => from < to && to <= length)
					.map(([from, to]) => clozeAnswerMark.range(from, to)),
				true,
			);
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field),
});
