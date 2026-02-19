import { useState, useCallback, useMemo, useEffect } from "preact/hooks";
import type { ReadonlySignal } from "@preact/signals";
import { type TFile, normalizePath } from "obsidian";
import { useApp, usePlugin } from "../preact";
import { Panel, SearchInput, ActionButton } from "../preact/components";
import type { OrphanedCardGroup } from "../../services/flashcard/orphaned-cards.service";

function useOrphanedCards() {
	const plugin = usePlugin();

	const load = useCallback((): OrphanedCardGroup[] => {
		if (!plugin.orphanedCardsService || !plugin.cardStore || !plugin.frontmatterIndex) {
			return [];
		}
		const orphans = plugin.orphanedCardsService.getOrphanedCardsExtended(
			plugin.cardStore,
			plugin.frontmatterIndex,
		);
		return plugin.orphanedCardsService.groupOrphanedCards(orphans);
	}, [plugin]);

	return load;
}

// ── Main App ──────────────────────────────────────────────

interface OrphanedCardsAppProps {
	refreshSignal?: ReadonlySignal<number>;
}

export function OrphanedCardsApp({ refreshSignal }: OrphanedCardsAppProps) {
	const plugin = usePlugin();
	const app = useApp();
	const loadGroups = useOrphanedCards();

	const [groups, setGroups] = useState<OrphanedCardGroup[]>(() => loadGroups());
	const [moveTarget, setMoveTarget] = useState<OrphanedCardGroup | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const totalCount = useMemo(
		() => groups.reduce((sum, g) => sum + g.cards.length, 0),
		[groups],
	);

	const refresh = useCallback(() => {
		setGroups(loadGroups());
		setMoveTarget(null);
		setSearchQuery("");
	}, [loadGroups]);

	// External refresh trigger (e.g. native header action button)
	useEffect(() => {
		if (refreshSignal) {
			// Subscribe by reading .value -- Preact signals auto-track
			const v = refreshSignal.value;
			if (v > 0) refresh();
		}
	}, [refreshSignal?.value, refresh]);

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
			const frontmatterService = plugin.flashcardManager.getFrontmatterService();
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
				.map((c) => `- ${c.question.slice(0, 80)}${c.question.length > 80 ? "..." : ""}`)
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

			const frontmatterService = plugin.flashcardManager.getFrontmatterService();

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

// ── Empty State ───────────────────────────────────────────

function OrphanedEmptyState() {
	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-12">
			<div class="ep:text-4xl ep:mb-4">✨</div>
			<div class="ep:text-obs-normal ep:text-ui-small ep:font-medium ep:mb-2">
				No orphaned cards!
			</div>
			<div class="ep:text-obs-muted ep:text-ui-smaller">
				All your flashcards are properly linked to source notes.
			</div>
		</div>
	);
}

// ── Group Row ─────────────────────────────────────────────

interface GroupRowProps {
	group: OrphanedCardGroup;
	onDelete: (group: OrphanedCardGroup) => void;
	onCreateNote: (group: OrphanedCardGroup) => void;
	onMove: (group: OrphanedCardGroup) => void;
}

function GroupRow({ group, onDelete, onCreateNote, onMove }: GroupRowProps) {
	const [expanded, setExpanded] = useState(false);
	const icon = group.reason === "no_source_uid" ? "❓" : "🗑️";
	const maxPreview = 5;

	return (
		<div class="ep:border-b ep:border-obs-border ep:last:border-b-0">
			{/* Group header */}
			<div
				class="ep:flex ep:items-center ep:justify-between ep:p-3 ep:bg-obs-secondary ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
				onClick={() => setExpanded((v) => !v)}
			>
				<div class="ep:flex ep:items-center ep:gap-3">
					<span class="ep:text-lg">{icon}</span>
					<div>
						<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
							{group.displayName}
						</div>
						<div class="ep:text-ui-smaller ep:text-obs-muted">
							{group.cards.length} card{group.cards.length === 1 ? "" : "s"}
						</div>
					</div>
				</div>

				<div class="ep:flex ep:items-center ep:gap-2">
					<button
						class="ep:py-1 ep:px-2 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-smaller ep:cursor-pointer ep:hover:opacity-80 ep:border-none"
						onClick={(e) => {
							e.stopPropagation();
							onMove(group);
						}}
					>
						Move
					</button>
					<button
						class="ep:py-1 ep:px-2 ep:rounded-md ep:bg-obs-secondary ep:text-obs-normal ep:text-ui-smaller ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:border ep:border-obs-border"
						onClick={(e) => {
							e.stopPropagation();
							onCreateNote(group);
						}}
					>
						Create note
					</button>
					<button
						class="ep:py-1 ep:px-2 ep:rounded-md ep:bg-obs-red ep:text-obs-on-accent ep:text-ui-smaller ep:cursor-pointer ep:hover:opacity-90 ep:border-none"
						onClick={(e) => {
							e.stopPropagation();
							onDelete(group);
						}}
					>
						Delete
					</button>
				</div>
			</div>

			{/* Expandable card preview */}
			{expanded && (
				<div class="ep:pl-8 ep:pr-3 ep:pb-2">
					{group.cards.slice(0, maxPreview).map((card) => (
						<div
							key={card.id}
							class="ep:py-2 ep:border-b ep:border-obs-border ep:last:border-b-0"
						>
							<div class="ep:text-ui-smaller ep:text-obs-normal">
								Q: {card.question.length > 100
									? card.question.slice(0, 100) + "..."
									: card.question}
							</div>
						</div>
					))}
					{group.cards.length > maxPreview && (
						<div class="ep:text-ui-smaller ep:text-obs-muted ep:pt-2">
							... and {group.cards.length - maxPreview} more
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ── Move Section ──────────────────────────────────────────

interface MoveSectionProps {
	group: OrphanedCardGroup;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onSelectNote: (note: TFile) => void;
	onCancel: () => void;
}

function MoveSection({
	group,
	searchQuery,
	onSearchChange,
	onSelectNote,
	onCancel,
}: MoveSectionProps) {
	const app = useApp();

	const allNotes = useMemo(() => app.vault.getMarkdownFiles(), [app]);

	const filteredNotes = useMemo(() => {
		if (!searchQuery) {
			return allNotes.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}
		const q = searchQuery.toLowerCase();
		return allNotes
			.filter(
				(note) =>
					note.basename.toLowerCase().includes(q) ||
					note.path.toLowerCase().includes(q),
			)
			.sort((a, b) => a.basename.localeCompare(b.basename));
	}, [allNotes, searchQuery]);

	const displayNotes = filteredNotes.slice(0, 20);

	return (
		<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
			<h4 class="ep:text-ui-small ep:text-obs-normal ep:m-0 ep:mb-3">
				Move {group.cards.length} cards to:
			</h4>

			<SearchInput
				value={searchQuery}
				placeholder="Search notes..."
				onChange={onSearchChange}
				class="ep:mb-3"
			/>

			<div class="ep:max-h-[200px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded-lg">
				{displayNotes.length === 0 ? (
					<div class="ep:p-4 ep:text-center ep:text-obs-muted ep:text-ui-smaller">
						No notes found
					</div>
				) : (
					displayNotes.map((note) => (
						<NoteRow
							key={note.path}
							note={note}
							onSelect={() => onSelectNote(note)}
						/>
					))
				)}
			</div>

			<button
				class="ep:mt-3 ep:py-2 ep:px-4 ep:rounded-md ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
				onClick={onCancel}
			>
				Cancel
			</button>
		</div>
	);
}

// ── Note Row ──────────────────────────────────────────────

interface NoteRowProps {
	note: TFile;
	onSelect: () => void;
}

function NoteRow({ note, onSelect }: NoteRowProps) {
	return (
		<div
			class="ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
			onClick={onSelect}
		>
			<span class="ep:text-lg">📄</span>
			<div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					{note.basename}
				</div>
				{note.parent?.path && note.parent.path !== "/" && (
					<div class="ep:text-ui-smaller ep:text-obs-muted">
						{note.parent.path}
					</div>
				)}
			</div>
		</div>
	);
}
