interface ShortcutDef {
	key: string;
	action: string;
}

const SHORTCUTS_TEXTAREA: ShortcutDef[] = [
	{ key: "Ctrl+3", action: "#flashcard" },
	{ key: "Ctrl+B", action: "bold" },
	{ key: "Ctrl+I", action: "italic" },
	{ key: "Ctrl+K", action: "[[link]]" },
	{ key: "Ctrl+Shift+C", action: "```code```" },
	{ key: "Ctrl+Enter", action: "save" },
];

const SHORTCUTS_RICH: ShortcutDef[] = [
	{ key: "Ctrl+3", action: "#flashcard" },
	{ key: "Ctrl+Enter", action: "save" },
	{ key: "Esc", action: "close" },
];

export function KeyboardShortcutsHint({
	useRichEditor = false,
}: { useRichEditor?: boolean }) {
	const shortcuts = useRichEditor ? SHORTCUTS_RICH : SHORTCUTS_TEXTAREA;

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
