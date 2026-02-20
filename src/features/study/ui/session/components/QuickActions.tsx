import { useMemo } from "preact/hooks";
import type { SessionLogic } from "../SessionLogic";

const BASE_BTN =
	"ep:flex ep:flex-col ep:items-start ep:gap-1.5 ep:px-3 ep:py-3 ep:min-h-[3rem] ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-left ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive";
const DISABLED_BTN = `${BASE_BTN} ep:opacity-50 ep:cursor-not-allowed ep:hover:bg-obs-secondary ep:hover:border-obs-border`;

interface QuickActionsProps {
	logic: SessionLogic;
	currentNoteName: string | null;
	now: Date;
	onAction: (action: "current-note" | "today" | "default" | "buried") => void;
}

export function QuickActions({
	logic,
	currentNoteName,
	now,
	onAction,
}: QuickActionsProps) {
	const todayStart = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);
	const currentNoteStats = logic.getCurrentNoteStats(currentNoteName, now);
	const todayStats = logic.getTodayStats(now, todayStart);
	const allStats = logic.getAllCardsStats(now);
	const buriedStats = logic.getBuriedCardsStats(now);

	return (
		<div class="true-recall-quick-actions ep:grid ep:grid-cols-2 ep:gap-2">
			<QuickActionBtn
				label="Active note"
				stats={
					currentNoteStats && currentNoteStats.total > 0
						? logic.formatStats(
								currentNoteStats.newCount,
								currentNoteStats.dueCount,
							)
						: null
				}
				emptyText={currentNoteStats ? "done" : "no cards"}
				onClick={() => onAction("current-note")}
			/>
			<QuickActionBtn
				label="Today"
				stats={
					todayStats.total > 0
						? logic.formatStats(todayStats.newCount, todayStats.dueCount)
						: null
				}
				emptyText="no cards"
				onClick={() => onAction("today")}
			/>
			<QuickActionBtn
				label="Default"
				stats={
					allStats.total > 0
						? logic.formatStats(allStats.newCount, allStats.dueCount)
						: null
				}
				emptyText="no cards"
				onClick={() => onAction("default")}
			/>
			<QuickActionBtn
				label="Buried"
				stats={
					buriedStats.total > 0
						? logic.formatStats(buriedStats.newCount, buriedStats.dueCount)
						: null
				}
				emptyText="none"
				onClick={() => onAction("buried")}
			/>
		</div>
	);
}

function QuickActionBtn({
	label,
	stats,
	emptyText,
	onClick,
}: {
	label: string;
	stats: string | null;
	emptyText: string;
	onClick: () => void;
}) {
	const disabled = !stats;
	return (
		<button
			type="button"
			class={disabled ? DISABLED_BTN : BASE_BTN}
			disabled={disabled}
			onClick={disabled ? undefined : onClick}
		>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{label}
			</span>
			<span
				class={
					stats
						? "ep:text-ui-smaller ep:text-obs-muted"
						: "ep:text-ui-smaller ep:text-obs-faint"
				}
			>
				{stats ?? emptyText}
			</span>
		</button>
	);
}
