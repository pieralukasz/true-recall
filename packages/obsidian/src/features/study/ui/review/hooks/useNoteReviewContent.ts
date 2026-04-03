import { NoteReviewService } from "@true-recall/core/services/note-review/note-review.service";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useState } from "preact/hooks";

export function useNoteReviewContent(
	sourceNotePath: string | undefined,
	cardId: string,
	showFrontmatter: boolean,
): string | null {
	const app = useApp();
	const [content, setContent] = useState<string | null>(null);

	useEffect(() => {
		if (!sourceNotePath) {
			setContent(null);
			return;
		}

		const file = app.vault.getFileByPath(sourceNotePath);
		if (!file) {
			setContent(null);
			return;
		}

		let cancelled = false;
		void app.vault
			.cachedRead(file)
			.then((text) => {
				if (cancelled) return;
				const processed = showFrontmatter
					? text
					: NoteReviewService.stripFrontmatter(text);
				setContent(processed);
			})
			.catch(() => {
				if (!cancelled) setContent(null);
			});

		return () => {
			cancelled = true;
		};
	}, [app, sourceNotePath, cardId, showFrontmatter]);

	return content;
}
