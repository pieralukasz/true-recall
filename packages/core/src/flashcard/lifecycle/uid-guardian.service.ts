import type { DomainEventBus } from "@true-recall/core/events/event-bus";
import type { INotification } from "@true-recall/core/interfaces/notification";
import type { IUidRemovalPrompt } from "@true-recall/core/interfaces/uid-removal-prompt";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
import type { FrontmatterService } from "../source/frontmatter.service";
import type { ISessionPersistence } from "./deletion-handler.service";

export interface UidGuardianDeps {
	frontmatterIndex: FrontmatterIndexService;
	store: SqliteStoreService;
	sessionPersistence: ISessionPersistence;
	frontmatterService: FrontmatterService;
	prompt: IUidRemovalPrompt;
	notification: INotification;
	bus: DomainEventBus;
}

export class UidGuardianService {
	private restoringPaths = new Set<string>();

	constructor(private deps: UidGuardianDeps) {}

	register(): void {
		this.deps.frontmatterIndex.onFieldChange("flashcard_uid", (event) => {
			this.handleFieldChange(event).catch((e) => {
				console.error("[UidGuardian] Failed to handle UID change:", e);
				this.deps.notification.error(
					"Failed to handle flashcard UID change. Cards may be orphaned.",
				);
			});
		});
	}

	private async handleFieldChange(event: {
		oldValues: string[];
		newValues: string[];
		path: string;
	}): Promise<void> {
		if (event.oldValues.length === 0) return;

		const removedUid = event.oldValues[0];
		if (!removedUid) return;

		if (this.restoringPaths.has(event.path)) {
			this.restoringPaths.delete(event.path);
			return;
		}

		const cards = this.deps.store.getCardsBySourceUid(removedUid);
		if (cards.length === 0) return;

		const lastSlash = event.path.lastIndexOf("/");
		const filename =
			lastSlash >= 0 ? event.path.substring(lastSlash + 1) : event.path;
		const fileName = filename.replace(/\.md$/, "");

		// VALUE CHANGED — auto-restore to prevent silent orphaning
		if (event.newValues.length > 0 && event.newValues[0] !== removedUid) {
			this.restoringPaths.add(event.path);
			await this.deps.frontmatterService.setSourceNoteUid(
				event.path,
				removedUid,
			);
			this.deps.notification.show(
				`flashcard_uid restored — ${cards.length} card${cards.length === 1 ? "" : "s"} protected`,
			);
			return;
		}

		// VALUE REMOVED — ask platform for user decision
		const result = await this.deps.prompt.onUidRemoved({
			path: event.path,
			removedUid,
			cardCount: cards.length,
			fileName,
		});

		switch (result.action) {
			case "restore":
				this.restoringPaths.add(event.path);
				await this.deps.frontmatterService.setSourceNoteUid(
					event.path,
					removedUid,
				);
				break;

			case "delete": {
				const cardIds = cards.map((c) => c.id);
				this.deps.store.cards.bulkSoftDelete(cardIds);
				this.deps.sessionPersistence.removeReviewedCards(cardIds);
				this.deps.bus.emit("cards:bulk", {
					cardIds,
					action: "removed",
				});
				this.deps.notification.show(
					`${cardIds.length} card${cardIds.length === 1 ? "" : "s"} deleted`,
				);
				break;
			}

			case "move":
				if (result.targetNotePath) {
					await this.moveCardsToNote(
						cards.map((c) => c.id),
						result.targetNotePath,
					);
				} else {
					this.restoringPaths.add(event.path);
					await this.deps.frontmatterService.setSourceNoteUid(
						event.path,
						removedUid,
					);
					this.deps.notification.show("No target note selected — UID restored");
				}
				break;
		}
	}

	private async moveCardsToNote(
		cardIds: string[],
		targetNotePath: string,
	): Promise<void> {
		let targetUid =
			await this.deps.frontmatterService.getSourceNoteUid(targetNotePath);
		if (!targetUid) {
			targetUid = this.deps.frontmatterService.generateUid();
			await this.deps.frontmatterService.setSourceNoteUid(
				targetNotePath,
				targetUid,
			);
		}

		for (const cardId of cardIds) {
			this.deps.store.cards.updateCardSourceUid(cardId, targetUid);
		}

		this.deps.bus.emit("card:updated", {
			cardId: cardIds[0] ?? "",
			changes: { sourceUid: true },
		});

		const lastSlash = targetNotePath.lastIndexOf("/");
		const filename =
			lastSlash >= 0 ? targetNotePath.substring(lastSlash + 1) : targetNotePath;
		const targetName = filename.replace(/\.md$/, "");
		this.deps.notification.show(
			`${cardIds.length} card${cardIds.length === 1 ? "" : "s"} moved to "${targetName}"`,
		);
	}
}
