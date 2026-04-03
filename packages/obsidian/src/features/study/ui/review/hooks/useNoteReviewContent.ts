import { NoteReviewService } from "@true-recall/core/services/note-review/note-review.service";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export interface NoteReviewContent {
	content: string | null;
	save: (edited: string) => void;
}

export function useNoteReviewContent(
	sourceNotePath: string | undefined,
	cardId: string,
	showFrontmatter: boolean,
): NoteReviewContent {
	const app = useApp();
	const [content, setContent] = useState<string | null>(null);
	const frontmatterRef = useRef("");

	useEffect(() => {
		if (!sourceNotePath) {
			setContent(null);
			frontmatterRef.current = "";
			return;
		}

		const file = app.vault.getFileByPath(sourceNotePath);
		if (!file) {
			setContent(null);
			frontmatterRef.current = "";
			return;
		}

		let cancelled = false;
		void app.vault
			.cachedRead(file)
			.then((text) => {
				if (cancelled) return;
				const { frontmatter, body } = NoteReviewService.splitFrontmatter(text);
				frontmatterRef.current = frontmatter;
				setContent(showFrontmatter ? text : body);
			})
			.catch(() => {
				if (!cancelled) setContent(null);
			});

		return () => {
			cancelled = true;
		};
	}, [app, sourceNotePath, cardId, showFrontmatter]);

	const save = useCallback(
		(edited: string) => {
			if (!sourceNotePath) return;
			const file = app.vault.getFileByPath(sourceNotePath);
			if (!file) return;
			const fullContent = showFrontmatter
				? edited
				: frontmatterRef.current + edited;
			void app.vault.modify(file, fullContent);
		},
		[app, sourceNotePath, showFrontmatter],
	);

	return { content, save };
}
