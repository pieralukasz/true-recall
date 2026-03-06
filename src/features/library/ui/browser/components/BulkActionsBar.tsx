import { ChangeNoteTypeModal } from "@features/library/modals/ChangeNoteTypeModal";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import { Clickable } from "@shared/ui/components";
import { useApp, usePlugin } from "@shared/ui/preact";
import { useCallback } from "preact/hooks";

interface BulkActionsBarProps {
	selectedCount: number;
	selectedIds: Set<string>;
	onClearSelection: () => void;
	onSelectAll: () => void;
	totalCount: number;
}

export function BulkActionsBar({
	selectedCount,
	selectedIds,
	onClearSelection,
	onSelectAll,
	totalCount,
}: BulkActionsBarProps) {
	const app = useApp();
	const plugin = usePlugin();
	const ids = Array.from(selectedIds);

	const handleSuspend = useCallback(() => {
		const count = plugin.cardStore.cards.bulkSuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "suspend" });
		notify().success(`Suspended ${count} cards`);
		onClearSelection();
	}, [ids, plugin]);

	const handleUnsuspend = useCallback(() => {
		const count = plugin.cardStore.cards.bulkUnsuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "unsuspend" });
		notify().success(`Unsuspended ${count} cards`);
		onClearSelection();
	}, [ids, plugin]);

	const handleReset = useCallback(() => {
		const count = plugin.cardStore.cards.bulkReset(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "reset" });
		notify().success(`Reset ${count} cards`);
		onClearSelection();
	}, [ids, plugin]);

	const handleChangeType = useCallback(async () => {
		const noteInfos = plugin.cardStore.cards.getNoteInfoForCardIds(ids);
		if (noteInfos.length === 0) return;

		const uniqueTypeIds = new Set(noteInfos.map((n) => n.noteTypeId));
		if (uniqueTypeIds.size > 1) {
			notify().error(
				"Selected cards have different note types. Select cards of one type.",
			);
			return;
		}

		const currentTypeId = noteInfos[0]?.noteTypeId;
		const currentNoteType = plugin.cardStore.noteTypes.getById(currentTypeId);
		if (!currentNoteType) return;

		const allNoteTypes = plugin.cardStore.noteTypes.getAll();

		const modal = new ChangeNoteTypeModal(app, {
			currentNoteType,
			availableNoteTypes: allNoteTypes,
			noteCount: noteInfos.length,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		let _totalKept = 0;
		let totalCreated = 0;
		let totalDeleted = 0;

		for (const info of noteInfos) {
			const r = plugin.flashcardManager.changeNoteType(
				info.noteId,
				result.targetNoteTypeId,
				result.fieldMapping,
			);
			_totalKept += r.keptCardIds.length;
			totalCreated += r.createdCardIds.length;
			totalDeleted += r.deletedCardIds.length;
		}

		const parts: string[] = [`${noteInfos.length} note(s) changed`];
		if (totalCreated > 0) parts.push(`${totalCreated} cards created`);
		if (totalDeleted > 0) parts.push(`${totalDeleted} cards removed`);
		notify().success(parts.join(", "));
		onClearSelection();
	}, [ids, plugin, app]);

	const handleDelete = useCallback(() => {
		if (!confirm(`Delete ${ids.length} cards? This cannot be undone.`)) return;
		const count = plugin.cardStore.cards.bulkSoftDelete(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "delete" });
		notify().success(`Deleted ${count} cards`);
		onClearSelection();
	}, [ids, plugin]);

	return (
		<div class="ep:shrink-0 ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-interactive/5 ep:border-b ep:border-obs-interactive/20">
			<span class="ep:text-sm ep:font-medium ep:text-obs-normal">
				{selectedCount} selected
			</span>

			{selectedCount < totalCount && (
				<Clickable
					class="ep:text-[11px] ep:text-obs-interactive ep:underline"
					onClick={onSelectAll}
				>
					Select all {totalCount}
				</Clickable>
			)}

			<div class="ep:ml-auto ep:flex ep:items-center ep:gap-1.5">
				<ActionButton label="Suspend" onClick={handleSuspend} />
				<ActionButton label="Unsuspend" onClick={handleUnsuspend} />
				<ActionButton label="Reset" onClick={handleReset} />
				<ActionButton label="Change type" onClick={handleChangeType} />
				<ActionButton label="Delete" onClick={handleDelete} danger />
			</div>

			<Clickable
				class="ep:p-1 ep:rounded hover:ep:bg-obs-modifier-hover ep:text-obs-muted"
				onClick={onClearSelection}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</Clickable>
		</div>
	);
}

function ActionButton({
	label,
	onClick,
	danger = false,
}: {
	label: string;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<Clickable
			class={`ep:px-2.5 ep:py-1 ep:rounded ep:text-[11px] ep:font-medium ep:border ep:border-obs-border hover:ep:bg-obs-modifier-hover ${
				danger
					? "ep:text-obs-error hover:ep:border-obs-error/30"
					: "ep:text-obs-normal"
			}`}
			onClick={onClick}
		>
			{label}
		</Clickable>
	);
}
