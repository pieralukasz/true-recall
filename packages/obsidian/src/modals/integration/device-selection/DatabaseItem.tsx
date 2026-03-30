import type { DeviceDatabaseInfo } from "@true-recall/core/integration/device-discovery.service";

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
	});
}

function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) {
		return "just now";
	} else if (diffMinutes < 60) {
		return `${diffMinutes}min ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		return formatDate(date);
	}
}

export function DatabaseItem({
	db,
	isSelected,
	onSelect,
}: {
	db: DeviceDatabaseInfo;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const statsParts: string[] = [];
	if (db.cardCount !== null) {
		statsParts.push(`${db.cardCount.toLocaleString()} cards`);
	}
	if (db.lastReviewDate) {
		statsParts.push(`Last: ${formatDate(db.lastReviewDate)}`);
	}

	return (
		<div
			class={`ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ${isSelected ? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive" : ""}`}
			role="option"
			tabIndex={0}
			aria-selected={isSelected}
			onClick={onSelect}
			onKeyDown={(e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
		>
			<div>
				<div class="ep:flex ep:items-center ep:gap-2">
					<span>device</span>
					<span class="ep:font-mono">{db.deviceId}</span>
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:mt-1">
					{statsParts.join(" | ")}
				</div>
			</div>
			<div class="ep:text-right ep:text-ui-smaller ep:text-obs-muted">
				<div>{db.formattedSize}</div>
				<div>Mod: {formatRelativeTime(db.lastModified)}</div>
			</div>
		</div>
	);
}
