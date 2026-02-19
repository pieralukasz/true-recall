import { cva, type VariantProps } from "class-variance-authority";
import type { NoteStatusInfo } from "../../../services/cache/note-status-cache.service";

const wrapperVariants = cva(
	"ep-link-count ep:inline-flex ep:items-center ep:gap-0.5 ep:align-middle ep:transition-colors ep:hover:text-obs-accent",
	{
		variants: {
			variant: {
				link: "ep:mb-[3px] ep:text-xs ep:ml-1",
				h1: "ep:mb-[3px] ep:ml-2 ep:text-sm ep:opacity-80",
				h2: "ep:mb-[3px] ep:ml-2 ep:text-xs ep:opacity-80",
				h3: "ep:mb-0.5 ep:ml-2 ep:text-[11px] ep:opacity-80",
				h4: "ep:mb-0.5 ep:ml-2 ep:text-[10px] ep:opacity-75",
				h5: "ep:mb-0.5 ep:ml-2 ep:text-[10px] ep:opacity-75",
				h6: "ep:mb-0.5 ep:ml-2 ep:text-[10px] ep:opacity-75",
			},
		},
		defaultVariants: { variant: "link" },
	},
);

const COUNT_CLS = {
	new: "ep:text-obs-green ep:tabular-nums",
	learning: "ep:text-obs-orange ep:tabular-nums",
	due: "ep:text-obs-blue ep:tabular-nums",
	muted: "ep:text-obs-muted ep:tabular-nums",
	sep: "ep:text-obs-faint ep:mx-px",
} as const;

const _PLAY_BTN_BASE =
	"ep:cursor-pointer ep:ml-0.5 ep:font-bold ep:transition-colors ep:hover:text-obs-accent";

export interface LinkTextCountProps
	extends VariantProps<typeof wrapperVariants> {
	info: NoteStatusInfo;
	onPlay?: () => void;
}

export function LinkTextCount({ info, variant }: LinkTextCountProps) {
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

	// const isHeading = variant != null && variant !== "link";
	// const playBtnCls = `${isHeading ? "ep:text-obs-muted" : "ep:text-obs-faint"} ${PLAY_BTN_BASE}`;
	// _playBtnCls;
	return (
		<span
			class={wrapperVariants({ variant })}
			title={`Due: ${info.dueToday}, Learning: ${info.learning}, New: ${info.new}, Total: ${info.total}`}
		>
			{countElements}
			<span class={COUNT_CLS.muted}>
				{parts.length > 0 ? `(${info.total})` : `(${info.total} cards)`}
			</span>
			{/* {onPlay && (
				<Clickable class={playBtnCls} onClick={onPlay}>
					{"\u2026"}
				</Clickable>
			)} */}
		</span>
	);
}
