import type { EditorView } from "@codemirror/view";

// ── Surrounding marker detection ─────────────────────────────────────────

const SCAN_RANGE = 200;

interface MarkerSpan {
	openStart: number;
	openEnd: number;
	closeStart: number;
	closeEnd: number;
}

function findSurroundingMarkers(
	view: EditorView,
	pos: number,
	before: string,
	after: string,
): MarkerSpan | null {
	const doc = view.state.doc;
	const searchStart = Math.max(0, pos - SCAN_RANGE);
	const searchEnd = Math.min(doc.length, pos + SCAN_RANGE);

	const textBefore = doc.sliceString(searchStart, pos);
	const openIdx = textBefore.lastIndexOf(before);
	if (openIdx === -1) return null;
	const absOpen = searchStart + openIdx;

	const textAfter = doc.sliceString(pos, searchEnd);
	const closeIdx = textAfter.indexOf(after);
	if (closeIdx === -1) return null;
	const absClose = pos + closeIdx;

	return {
		openStart: absOpen,
		openEnd: absOpen + before.length,
		closeStart: absClose,
		closeEnd: absClose + after.length,
	};
}

// ── Toggle functions ─────────────────────────────────────────────────────

/**
 * Toggle symmetric marker (e.g. `**`, `*`, `` ` ``, `$`).
 *
 * Three modes:
 * 1. Selection includes markers at boundaries → unwrap
 * 2. Cursor/selection sits inside markers → scan outward, remove them
 * 3. Otherwise → wrap selection (or insert empty pair at cursor)
 */
export function toggleMarker(view: EditorView, marker: string): void {
	const { from, to } = view.state.selection.main;
	const selected = view.state.sliceDoc(from, to);
	const mLen = marker.length;

	// Case 1: selection itself is wrapped
	if (
		selected.startsWith(marker) &&
		selected.endsWith(marker) &&
		selected.length > mLen * 2
	) {
		view.dispatch({
			changes: { from, to, insert: selected.slice(mLen, -mLen) },
		});
		view.focus();
		return;
	}

	// Case 2: check if text immediately outside selection is the marker
	const outerBefore = view.state.sliceDoc(from - mLen, from);
	const outerAfter = view.state.sliceDoc(to, to + mLen);
	if (outerBefore === marker && outerAfter === marker) {
		const inner = view.state.sliceDoc(from, to);
		view.dispatch({
			changes: { from: from - mLen, to: to + mLen, insert: inner },
			selection: { anchor: from - mLen, head: to - mLen },
		});
		view.focus();
		return;
	}

	// Case 3: cursor inside markers (scan outward)
	const span = findSurroundingMarkers(view, from, marker, marker);
	if (span && span.openEnd <= from && span.closeStart >= to) {
		const inner = view.state.sliceDoc(span.openEnd, span.closeStart);
		view.dispatch({
			changes: { from: span.openStart, to: span.closeEnd, insert: inner },
			selection: {
				anchor: from - mLen,
				head: Math.max(from - mLen, to - mLen),
			},
		});
		view.focus();
		return;
	}

	// Case 4: wrap
	view.dispatch({
		changes: { from, to, insert: `${marker}${selected}${marker}` },
		selection: { anchor: from + mLen, head: to + mLen },
	});
	view.focus();
}

/**
 * Toggle asymmetric markers (e.g. `<u>`/`</u>`, `[[`/`]]`).
 * Same three-mode logic as toggleMarker.
 */
export function toggleAsymmetricMarker(
	view: EditorView,
	before: string,
	after: string,
): void {
	const { from, to } = view.state.selection.main;
	const selected = view.state.sliceDoc(from, to);
	const bLen = before.length;
	const aLen = after.length;

	// Case 1: selection itself is wrapped
	if (
		selected.startsWith(before) &&
		selected.endsWith(after) &&
		selected.length > bLen + aLen
	) {
		view.dispatch({
			changes: { from, to, insert: selected.slice(bLen, -aLen) },
		});
		view.focus();
		return;
	}

	// Case 2: markers immediately outside selection
	const outerBefore = view.state.sliceDoc(from - bLen, from);
	const outerAfter = view.state.sliceDoc(to, to + aLen);
	if (outerBefore === before && outerAfter === after) {
		const inner = view.state.sliceDoc(from, to);
		view.dispatch({
			changes: { from: from - bLen, to: to + aLen, insert: inner },
			selection: { anchor: from - bLen, head: to - bLen },
		});
		view.focus();
		return;
	}

	// Case 3: cursor inside markers (scan outward)
	const span = findSurroundingMarkers(view, from, before, after);
	if (span && span.openEnd <= from && span.closeStart >= to) {
		const inner = view.state.sliceDoc(span.openEnd, span.closeStart);
		view.dispatch({
			changes: { from: span.openStart, to: span.closeEnd, insert: inner },
			selection: {
				anchor: from - bLen,
				head: Math.max(from - bLen, to - bLen),
			},
		});
		view.focus();
		return;
	}

	// Case 4: wrap
	view.dispatch({
		changes: { from, to, insert: `${before}${selected}${after}` },
		selection: { anchor: from + bLen, head: to + bLen },
	});
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
