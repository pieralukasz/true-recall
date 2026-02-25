import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type {
	FieldChangeEvent,
	FrontmatterIndexService,
} from "@features/core/services/frontmatter-index.service";
import type { FrontmatterService } from "@features/study/services/flashcard/frontmatter.service";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import { UidRemovedModal } from "../../modals/UidRemovedModal";

export interface UidGuardianDeps {
	app: App;
	frontmatterIndex: FrontmatterIndexService;
	store: SqliteStoreService;
	frontmatterService: FrontmatterService;
}

/**
 * Watches for accidental removal or modification of flashcard_uid in frontmatter.
 * Value changed → auto-restores original UID (no legitimate reason to edit it).
 * Value removed → shows recovery modal (restore / delete / move cards).
 */
export class UidGuardianService {
	private restoringPaths = new Set<string>();

	constructor(private deps: UidGuardianDeps) {}

	register(): void {
		this.deps.frontmatterIndex.onFieldChange(
			"flashcard_uid",
			(event) => void this.handleFieldChange(event),
		);
	}

	private async handleFieldChange(event: FieldChangeEvent): Promise<void> {
		if (event.oldValues.length === 0) return;

		const removedUid = event.oldValues[0];
		if (!removedUid) return;

		// Skip bounce-back from our own restore
		if (this.restoringPaths.has(event.path)) {
			this.restoringPaths.delete(event.path);
			return;
		}

		const cards = this.deps.store.getCardsBySourceUid(removedUid);
		if (cards.length === 0) return;

		const file = this.deps.app.vault.getAbstractFileByPath(event.path);
		if (!(file instanceof TFile)) return;

		// VALUE CHANGED — auto-restore to prevent silent orphaning
		if (event.newValues.length > 0 && event.newValues[0] !== removedUid) {
			this.restoringPaths.add(event.path);
			await this.deps.frontmatterService.setSourceNoteUid(file, removedUid);
			notify().info(
				`flashcard_uid restored — ${cards.length} card${cards.length === 1 ? "" : "s"} protected`,
			);
			return;
		}

		// VALUE REMOVED — show recovery modal
		const modal = new UidRemovedModal(this.deps.app, {
			fileName: file.basename,
			removedUid,
			cardCount: cards.length,
		});

		const result = await modal.openAndWait();

		if (result.cancelled) return;

		switch (result.action) {
			case "restore":
				this.restoringPaths.add(event.path);
				await this.deps.frontmatterService.setSourceNoteUid(file, removedUid);
				break;

			case "delete": {
				const cardIds = cards.map((c) => c.id);
				this.deps.store.cards.bulkSoftDelete(cardIds);
				notifyCardChange({ type: "bulk", cardIds, action: "delete" });
				notify().cardsDeleted(cardIds.length);
				break;
			}

			case "move":
				if (result.targetNotePath) {
					await this.moveCardsToNote(
						cards.map((c) => c.id),
						result.targetNotePath,
					);
				}
				break;
		}
	}

	private async moveCardsToNote(
		cardIds: string[],
		targetNotePath: string,
	): Promise<void> {
		const targetFile =
			this.deps.app.vault.getAbstractFileByPath(targetNotePath);
		if (!(targetFile instanceof TFile)) {
			notify().error("Target note not found");
			return;
		}

		let targetUid =
			await this.deps.frontmatterService.getSourceNoteUid(targetFile);
		if (!targetUid) {
			targetUid = this.deps.frontmatterService.generateUid();
			await this.deps.frontmatterService.setSourceNoteUid(
				targetFile,
				targetUid,
			);
		}

		for (const cardId of cardIds) {
			this.deps.store.cards.updateCardSourceUid(cardId, targetUid);
		}

		notifyCardChange({ type: "bulk", cardIds, action: "update" });
		notify().cardsMoved(cardIds.length, targetFile.basename);
	}
}
