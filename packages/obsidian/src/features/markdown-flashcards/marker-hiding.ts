import {
	type EditorState,
	type Extension,
	RangeSetBuilder,
	StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

const MARKER = /^\s*<!-- true-recall:.*-->\s*$/;

/**
 * Lines holding a True Recall card marker, as [from, to] document offsets.
 * Lines touched by a selection are left out so the marker shows while it is edited.
 */
export function markerLineRanges(
	lines: string[],
	selections: readonly { from: number; to: number }[] = [],
): [number, number][] {
	const ranges: [number, number][] = [];
	let offset = 0;
	for (const line of lines) {
		const from = offset;
		const to = offset + line.length;
		offset = to + 1;
		if (!MARKER.test(line)) continue;
		if (selections.some((s) => s.from <= to && s.to >= from)) continue;
		ranges.push([from, to]);
	}
	return ranges;
}

function build(state: EditorState): DecorationSet {
	if (!state.field(editorLivePreviewField, false)) return Decoration.none;
	const lines: string[] = [];
	for (let i = 1; i <= state.doc.lines; i++) lines.push(state.doc.line(i).text);
	const builder = new RangeSetBuilder<Decoration>();
	for (const [from, to] of markerLineRanges(lines, state.selection.ranges))
		builder.add(from, to, Decoration.replace({ block: true }));
	return builder.finish();
}

/** Hides Markdown flashcard ID/schedule comments in Live Preview; Source mode still shows them. */
export function createMarkerHidingExtension(): Extension {
	return StateField.define<DecorationSet>({
		create: build,
		update(decorations, tr) {
			const livePreviewChanged =
				tr.startState.field(editorLivePreviewField, false) !==
				tr.state.field(editorLivePreviewField, false);
			if (tr.docChanged || tr.selection || livePreviewChanged)
				return build(tr.state);
			return decorations;
		},
		provide: (field) => EditorView.decorations.from(field),
	});
}
