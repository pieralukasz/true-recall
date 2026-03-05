import type { EditorView } from "@codemirror/view";

/**
 * Toggle symmetric marker around selection (e.g. `**`, `*`, `` ` ``, `$`).
 * If already wrapped, unwraps. Otherwise wraps and keeps selection inside.
 */
export function toggleMarker(view: EditorView, marker: string): void {
	const { from, to } = view.state.selection.main;
	const selected = view.state.sliceDoc(from, to);
	const mLen = marker.length;
	if (
		selected.startsWith(marker) &&
		selected.endsWith(marker) &&
		selected.length > mLen * 2
	) {
		view.dispatch({
			changes: { from, to, insert: selected.slice(mLen, -mLen) },
		});
	} else {
		view.dispatch({
			changes: { from, to, insert: `${marker}${selected}${marker}` },
			selection: { anchor: from + mLen, head: to + mLen },
		});
	}
	view.focus();
}

/**
 * Toggle asymmetric markers around selection (e.g. `<u>`/`</u>`, `[[`/`]]`).
 */
export function toggleAsymmetricMarker(
	view: EditorView,
	before: string,
	after: string,
): void {
	const { from, to } = view.state.selection.main;
	const selected = view.state.sliceDoc(from, to);
	if (
		selected.startsWith(before) &&
		selected.endsWith(after) &&
		selected.length > before.length + after.length
	) {
		view.dispatch({
			changes: {
				from,
				to,
				insert: selected.slice(before.length, -after.length),
			},
		});
	} else {
		view.dispatch({
			changes: { from, to, insert: `${before}${selected}${after}` },
			selection: {
				anchor: from + before.length,
				head: to + before.length,
			},
		});
	}
	view.focus();
}

/**
 * Insert text at the current cursor position.
 */
export function insertAtCursor(view: EditorView, text: string): void {
	const { from, to } = view.state.selection.main;
	view.dispatch({
		changes: { from, to, insert: text },
		selection: { anchor: from + text.length },
	});
	view.focus();
}

/**
 * Strip known markdown formatting markers from selection.
 */
export function clearFormatting(view: EditorView): void {
	const { from, to } = view.state.selection.main;
	if (from === to) return;

	let text = view.state.sliceDoc(from, to);

	// Strip symmetric markers
	for (const m of ["**", "*", "`", "$$", "$"]) {
		// Avoid stripping `*` when `**` was already stripped
		if (m === "*" && !text.includes("*")) continue;
		const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		text = text.replace(new RegExp(`${escaped}(.+?)${escaped}`, "g"), "$1");
	}

	// Strip asymmetric markers
	const pairs: [string, string][] = [
		["<u>", "</u>"],
		["<sup>", "</sup>"],
		["<sub>", "</sub>"],
		["[[", "]]"],
	];
	for (const [b, a] of pairs) {
		const bE = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const aE = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		text = text.replace(new RegExp(`${bE}(.+?)${aE}`, "g"), "$1");
	}

	// Strip color spans
	text = text.replace(
		/<span style="color:[^"]*">(.+?)<\/span>/g,
		"$1",
	);

	if (text !== view.state.sliceDoc(from, to)) {
		view.dispatch({ changes: { from, to, insert: text } });
	}
	view.focus();
}
