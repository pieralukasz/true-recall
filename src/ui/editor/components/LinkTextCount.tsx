import type { NoteStatusInfo } from "../../../services/cache/note-status-cache.service";
import { Clickable } from "../../preact/components";

const WRAPPER_CLS =
	"ep-link-count ep:inline-flex ep:items-center ep:gap-0.5 ep:align-middle ep:cursor-pointer ep:transition-colors ep:hover:text-obs-accent ep:mb-[6px]";

const COUNT_CLS = {
	new: "ep:text-obs-green ep:tabular-nums",
	learning: "ep:text-obs-orange ep:tabular-nums",
	due: "ep:text-obs-blue ep:tabular-nums",
	muted: "ep:text-obs-muted ep:tabular-nums",
	sep: "ep:text-obs-faint ep:mx-px",
} as const;

const PLAY_BTN_CLS =
	"ep:text-obs-faint ep:cursor-pointer ep:ml-0.5 ep:font-bold ep:transition-colors ep:hover:text-obs-accent";

export interface LinkTextCountProps {
	info: NoteStatusInfo;
	onPlay?: () => void;
}

export function LinkTextCount({ info, onPlay }: LinkTextCountProps) {
	const parts: { count: number; label: string; cls: string }[] = [];
	if (info.new > 0)
		parts.push({ count: info.new, label: "new", cls: COUNT_CLS.new });
	if (info.learning > 0)
		parts.push({ count: info.learning, label: "lrn", cls: COUNT_CLS.learning });
	if (info.dueToday > 0)
		parts.push({ count: info.dueToday, label: "due", cls: COUNT_CLS.due });

	const countElements = parts.flatMap((part, i) => {
		const els: preact.JSX.Element[] = [];
		if (i > 0) {
			els.push(
				<span key={`sep-${i}`} class={COUNT_CLS.sep}>
					{"\u00B7"}
				</span>,
			);
		}
		els.push(
			<span key={part.label} class={part.cls}>
				{part.count} {part.label}
			</span>,
		);
		return els;
	});

	return (
		<span
			class={WRAPPER_CLS}
			title={`Due: ${info.dueToday}, Learning: ${info.learning}, New: ${info.new}, Total: ${info.total}`}
		>
			{countElements}
			<span class={COUNT_CLS.muted}>
				{parts.length > 0 ? `(${info.total})` : `(${info.total} cards)`}
			</span>
			{onPlay && (
				<Clickable class={PLAY_BTN_CLS} onClick={onPlay}>
					{"\u2026"}
				</Clickable>
			)}
		</span>
	);
}
