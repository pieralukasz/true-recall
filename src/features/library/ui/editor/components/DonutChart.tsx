import { cva, type VariantProps } from "class-variance-authority";
import { Clickable } from "shared/ui/preact";
import type { NoteStatusInfo } from "@features/core/cache/note-status-cache.service";

const CIRCUMFERENCE = 100;
const RADIUS = 15.91549430918954; // circumference / (2 * PI)
const STROKE_WIDTH = 3.8;

const donutVariants = cva(
	"ep-donut ep:inline-flex ep:items-center ep:justify-center ep:align-middle ep:cursor-pointer ep:transition-transform ep:hover:scale-[1.2]",
	{
		variants: {
			variant: {
				link: "ep:w-[calc(1.6em-8px)] ep:h-[calc(1.6em-8px)] ep:mr-1.5",
				h1: "ep:w-[30px] ep:h-[30px] ep:mr-[22px] ep:mb-1",
				h2: "ep:w-[28px] ep:h-[28px] ep:mr-[21px] ep:mb-1",
				h3: "ep:w-6 ep:h-6 ep:mr-[19px] ep:mb-1",
				h4: "ep:w-[21px] ep:h-[21px] ep:mr-5 ep:mb-0.5",
				h5: "ep:w-[19px] ep:h-[19px] ep:mr-5 ep:mb-0.5",
				h6: "ep:w-[18px] ep:h-[18px] ep:mr-5 ep:mb-0.5",
			},
		},
		defaultVariants: { variant: "link" },
	},
);

interface DonutSegment {
	length: number;
	offset: number;
	cls: string;
}

export interface DonutChartProps extends VariantProps<typeof donutVariants> {
	info: NoteStatusInfo;
	onPlay?: () => void;
}

export function DonutChart({ info, onPlay, variant }: DonutChartProps) {
	const segments: DonutSegment[] = [];
	let offset = 0;

	if (info.total > 0) {
		const duePercent = (info.dueToday / info.total) * CIRCUMFERENCE;
		const newPercent = (info.new / info.total) * CIRCUMFERENCE;
		const learningPercent = (info.learning / info.total) * CIRCUMFERENCE;

		if (duePercent > 0) {
			segments.push({
				length: duePercent,
				offset,
				cls: "true-recall-donut-due",
			});
			offset += duePercent;
		}
		if (newPercent > 0) {
			segments.push({
				length: newPercent,
				offset,
				cls: "true-recall-donut-new",
			});
			offset += newPercent;
		}
		if (learningPercent > 0) {
			segments.push({
				length: learningPercent,
				offset,
				cls: "true-recall-donut-learning",
			});
		}
	}

	return (
		<Clickable
			class={donutVariants({ variant })}
			aria-label={`Flashcards: ${info.new} new, ${info.learning} learning, ${info.dueToday} due today (${info.total} total)`}
			onClick={() => {
				onPlay?.();
			}}
		>
			<svg viewBox="0 0 36 36" class="true-recall-donut-svg">
				<title>{`Flashcards: ${info.new} new, ${info.learning} learning, ${info.dueToday} due today (${info.total} total)`}</title>
				<circle
					cx={18}
					cy={18}
					r={RADIUS}
					fill="none"
					stroke-width={STROKE_WIDTH}
					class="true-recall-donut-bg"
				/>
				{segments.map((seg) => (
					<circle
						key={seg.cls}
						cx={18}
						cy={18}
						r={RADIUS}
						fill="none"
						stroke-width={STROKE_WIDTH}
						class={seg.cls}
						stroke-dasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
						stroke-dashoffset={25 - seg.offset}
					/>
				))}
			</svg>
		</Clickable>
	);
}
