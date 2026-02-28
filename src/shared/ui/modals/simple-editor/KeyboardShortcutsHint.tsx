import { Platform } from "obsidian";

interface ShortcutDef {
	key: string;
	action: string;
}

function getShortcuts(useRichEditor: boolean): ShortcutDef[] {
	const mod = Platform.isMacOS ? "Cmd" : "Ctrl";

	if (useRichEditor) {
		return [
			{ key: `${mod}+3`, action: "#flashcard" },
			{ key: `${mod}+Enter`, action: "save" },
			{ key: "Esc", action: "close" },
		];
	}

	return [
		{ key: `${mod}+3`, action: "#flashcard" },
		{ key: `${mod}+B`, action: "bold" },
		{ key: `${mod}+I`, action: "italic" },
		{ key: `${mod}+K`, action: "[[link]]" },
		{ key: `${mod}+Shift+C`, action: "```code```" },
		{ key: `${mod}+Enter`, action: "save" },
	];
}

export function KeyboardShortcutsHint({
	useRichEditor = false,
}: { useRichEditor?: boolean }) {
	const shortcuts = getShortcuts(useRichEditor);

	return (
		<div class="ep:text-ui-smaller ep:text-obs-faint ep:mt-2 ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1">
			{shortcuts.map((s) => (
				<span key={s.key}>
					<kbd class="ep:px-1 ep:py-1 ep:bg-obs-secondary ep:rounded ep:text-ui-smaller ep:font-mono">
						{s.key}
					</kbd>
					{` ${s.action}`}
				</span>
			))}
		</div>
	);
}
