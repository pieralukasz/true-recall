import type { ReadonlySignal } from "@preact/signals";
import { normalizePath, type TFile } from "obsidian";
import { useCallback } from "preact/hooks";
import { ActionButton, Panel } from "../../../../shared/ui/components";
import { useApp, usePlugin } from "../../../../shared/ui/preact";
import type { OrphanedCardGroup } from "../../services/orphaned-cards.service";
import { GroupRow, MoveSection, OrphanedEmptyState } from "./components";
import { useOrphanedData } from "./hooks/useOrphanedData";

interface OrphanedCardsAppProps {
	refreshSignal?: ReadonlySignal<number>;
}

export function OrphanedCardsApp({ refreshSignal }: OrphanedCardsAppProps) {
	const plugin = usePlugin();
	const app = useApp();
	const {
		groups,
		totalCount,
		moveTarget,
		searchQuery,
		setMoveTarget,
		setSearchQuery,
		refresh,
	} = useOrphanedData(refreshSignal);

	const handleDeleteAll = useCallback(() => {
		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		const confirmed = window.confirm(
			`Delete all ${totalCount} orphaned cards? This cannot be undone.`,
		);
		if (!confirmed) return;

		const allCardIds = groups.flatMap((g) => g.cards.map((c) => c.id));
		plugin.cardStore.cards.bulkSoftDelete(allCardIds);
		refresh();
	}, [groups, totalCount, plugin, refresh]);

	const handleDeleteGroup = useCallback(
		(group: OrphanedCardGroup) => {
			// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
			const confirmed = window.confirm(
				`Delete ${group.cards.length} card${group.cards.length === 1 ? "" : "s"}? This cannot be undone.`,
			);
			if (!confirmed) return;

			const cardIds = group.cards.map((c) => c.id);
			plugin.cardStore.cards.bulkSoftDelete(cardIds);
			refresh();
		},
		[plugin, refresh],
	);

	const handleCreateNote = useCallback(
		async (group: OrphanedCardGroup) => {
			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			const folderPath = app.fileManager.getNewFileParent("")?.path ?? "";
			const baseName =
				group.reason === "missing_source_file"
					? `Recovered cards (${group.groupKey})`
					: "Recovered orphaned cards";

			let filePath = normalizePath(`${folderPath}/${baseName}.md`);
			let counter = 1;
			while (app.vault.getAbstractFileByPath(filePath)) {
				filePath = normalizePath(`${folderPath}/${baseName} ${counter}.md`);
				counter++;
			}

			const newUid = frontmatterService.generateUid();

			const cardList = group.cards
				.slice(0, 10)
				.map(
					(c) =>
						`- ${c.question.slice(0, 80)}${c.question.length > 80 ? "..." : ""}`,
				)
				.join("\n");

			const moreText =
				group.cards.length > 10
					? `\n- ... and ${group.cards.length - 10} more cards`
					: "";

			const content = `---
flashcard_uid: ${newUid}
tags:
  - recovered
---

# ${baseName}

This note was created to recover orphaned flashcards.

## Cards in this note

${cardList}${moreText}
`;

			await app.vault.create(filePath, content);

			const cardIds = group.cards.map((c) => c.id);
			for (const cardId of cardIds) {
				plugin.cardStore.cards.updateCardSourceUid(cardId, newUid);
			}

			refresh();
		},
		[app, plugin, refresh],
	);

	const handleMoveToNote = useCallback(
		async (targetNote: TFile) => {
			if (!moveTarget) return;

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();

			let targetUid = await frontmatterService.getSourceNoteUid(targetNote);
			if (!targetUid) {
				targetUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(targetNote, targetUid);
			}

			const cardIds = moveTarget.cards.map((c) => c.id);
			for (const cardId of cardIds) {
				plugin.cardStore.cards.updateCardSourceUid(cardId, targetUid);
			}

			refresh();
		},
		[moveTarget, plugin, refresh],
	);

	if (totalCount === 0) {
		return (
			<Panel>
				<div class="ep:p-4">
					<OrphanedEmptyState />
				</div>
			</Panel>
		);
	}

	return (
		<Panel>
			<div class="ep:p-4">
				<p class="ep:text-obs-muted ep:text-ui-small ep:mb-4">
					Found {totalCount} orphaned card{totalCount === 1 ? "" : "s"} in{" "}
					{groups.length} group{groups.length === 1 ? "" : "s"}.
				</p>

				<div class="ep:flex ep:justify-end ep:mb-3">
					<ActionButton
						label={`Delete all ${totalCount} cards`}
						variant="danger"
						onClick={handleDeleteAll}
						class="ep:!py-1.5 ep:!px-3 ep:!text-ui-smaller"
					/>
				</div>

				<div class="ep:max-h-[500px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded-lg">
					{groups.map((group) => (
						<GroupRow
							key={group.groupKey}
							group={group}
							onDelete={handleDeleteGroup}
							onCreateNote={handleCreateNote}
							onMove={setMoveTarget}
						/>
					))}
				</div>

				{moveTarget && (
					<MoveSection
						group={moveTarget}
						searchQuery={searchQuery}
						onSearchChange={setSearchQuery}
						onSelectNote={handleMoveToNote}
						onCancel={() => {
							setMoveTarget(null);
							setSearchQuery("");
						}}
					/>
				)}
			</div>
		</Panel>
	);
}
