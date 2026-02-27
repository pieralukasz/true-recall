import { Clickable } from "@shared/ui/components";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
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

	const handleDelete = useCallback(() => {
		if (!confirm(`Delete ${ids.length} cards? This cannot be undone.`))
			return;
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
				<ActionButton
					label="Delete"
					onClick={handleDelete}
					danger
				/>
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
