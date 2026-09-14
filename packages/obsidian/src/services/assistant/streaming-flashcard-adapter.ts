import type { StreamingFlashcardManager } from "@true-recall/core/ai/generation/streaming-generation.service";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";

export function createStreamingFlashcardAdapter(
	manager: FlashcardManager,
): StreamingFlashcardManager {
	return {
		getNoteTypeById: (id) => manager.getNoteTypeById(id),
		getNoteTypeBySlug: (slug) => manager.getNoteTypeBySlug(slug),
		createNote: (params) => ({
			cards: manager.createNote(params).cards.map((card) => ({
				...card,
				question: card.question ?? "",
				answer: card.answer ?? "",
			})),
		}),
		getFrontmatterService: () => {
			const frontmatter = manager.getFrontmatterService();
			return {
				getSourceNoteUid: (file) => frontmatter.getSourceNoteUid(file.path),
				setSourceNoteUid: (file, uid) =>
					frontmatter.setSourceNoteUid(file.path, uid),
				generateUid: () => frontmatter.generateUid(),
			};
		},
	};
}
