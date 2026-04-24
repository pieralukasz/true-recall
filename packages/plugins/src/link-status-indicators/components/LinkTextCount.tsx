import { cva, type VariantProps } from "class-variance-authority";

import type { NoteStatusInfo } from "@true-recall/obsidian/data";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";

const wrapperVariants = cva(
	"ep-link-count ep:inline-flex ep:items-center ep:gap-0.5 ep:align-middle  ",
	{
		variants: {
			variant: {
				link: "ep:mt-[1px] ep:text-xs ep:ml-1 ",
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
	new: `${FSRS_COLORS.new.textCls} ep:tabular-nums`,
	learning: `${FSRS_COLORS.learning.textCls} ep:tabular-nums`,
	due: `${FSRS_COLORS.review.textCls} ep:tabular-nums`,
	muted: "ep:text-obs-muted ep:tabular-nums",
	sep: "ep:text-obs-faint ep:mx-px",
} as const;

interface LinkTextCountProps extends VariantProps<typeof wrapperVariants> {
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

	return (
		<span
			class={wrapperVariants({ variant })}
			title={`Due: ${info.dueToday}, Learning: ${info.learning}, New: ${info.new}, Total: ${info.total}`}
		>
			{countElements}
			<span class={COUNT_CLS.muted}>
				{parts.length > 0 ? `(${info.total})` : `(${info.total} cards)`}
			</span>
		</span>
	);
}
