import type { CardRepository } from "./data/card-repository.service";
import type { FrontmatterService } from "./source/frontmatter.service";

export class CardAssignmentService {
	constructor(
		private getRepository: () => CardRepository | null,
		private frontmatterService: FrontmatterService,
	) {}
	private get cardRepository() {
		return this.getRepository();
	}

	async assignCardToSourceNote(
		cardId: string,
		targetNotePath: string,
	): Promise<boolean> {
		if (!this.cardRepository) {
			throw new Error("Store not initialized");
		}

		if (!this.cardRepository.has(cardId)) {
			return false;
		}

		let targetSourceUid =
			await this.frontmatterService.getSourceNoteUid(targetNotePath);
		if (!targetSourceUid) {
			targetSourceUid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(
				targetNotePath,
				targetSourceUid,
			);
		}

		// Update card's source UID (CardRepository calls notifyCardChange)
		return this.cardRepository.updateSourceUid(cardId, targetSourceUid);
	}

	async assignCardsToSourceNote(
		cardIds: string[],
		targetNotePath: string,
	): Promise<number> {
		let successCount = 0;
		for (const cardId of cardIds) {
			const success = await this.assignCardToSourceNote(cardId, targetNotePath);
			if (success) {
				successCount++;
			}
		}
		return successCount;
	}

	async moveCard(cardId: string, targetNotePath: string): Promise<boolean> {
		return this.assignCardToSourceNote(cardId, targetNotePath);
	}
}
