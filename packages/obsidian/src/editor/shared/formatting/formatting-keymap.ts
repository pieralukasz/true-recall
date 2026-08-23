import { type Extension, Prec } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";

import { toggleAsymmetricMarker, wrapCloze } from "./cm6-formatting";

/**
 * Shortcuts the FormattingToolbar advertises but Obsidian itself does not
 * provide: it ships no underline command, so Mod+U reached no handler at all,
 * and the cloze wrap is a True Recall concept. Bold, italic and highlight keep
 * coming from Obsidian's own editor commands, which already work here because
 * the embeddable editor mocks `owner.editor`.
 */
export const FORMATTING_KEYBINDINGS = [
	{
		key: "Mod-u",
		run: (view: EditorView): boolean => {
			toggleAsymmetricMarker(view, "<u>", "</u>");
			return true;
		},
	},
	{
		key: "Mod-Shift-c",
		run: (view: EditorView): boolean => {
			wrapCloze(view);
			return true;
		},
	},
];

/**
 * Prec.highest so the bindings win over Obsidian's own live-preview keymaps,
 * which the embeddable editor inherits wholesale.
 */
export function formattingKeymap(): Extension {
	return Prec.highest(keymap.of(FORMATTING_KEYBINDINGS));
}
