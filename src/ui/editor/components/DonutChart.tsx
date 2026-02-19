import type { NoteStatusInfo } from "../../../services/cache/note-status-cache.service";

const CIRCUMFERENCE = 100;
const RADIUS = 15.91549430918954; // circumference / (2 * PI)
const STROKE_WIDTH = 3.8;

const DONUT_CLS =
	"ep-donut ep:inline-flex ep:items-center ep:justify-center ep:w-[calc(1.6em-8px)] ep:h-[calc(1.6em-8px)] ep:align-middle ep:mr-1.5 ep:cursor-pointer ep:transition-transform ep:mb-0.5 ep:hover:scale-[1.2]";

interface DonutSegment {
	length: number;
	offset: number;
	cls: string;
}

export interface DonutChartProps {
	info: NoteStatusInfo;
	onPlay?: () => void;
	class?: string;
}

export function DonutChart({ info, onPlay, class: extraCls }: DonutChartProps) {
	const segments: DonutSegment[] = [];
	let offset = 0;

	if (info.total > 0) {
		const duePercent = (info.dueToday / info.total) * CIRCUMFERENCE;
		const newPercent = (info.new / info.total) * CIRCUMFERENCE;
		const learningPercent = (info.learning / info.total) * CIRCUMFERENCE;

		if (duePercent > 0) {
			segments.push({ length: duePercent, offset, cls: "true-recall-donut-due" });
			offset += duePercent;
		}
		if (newPercent > 0) {
			segments.push({ length: newPercent, offset, cls: "true-recall-donut-new" });
			offset += newPercent;
		}
		if (learningPercent > 0) {
			segments.push({ length: learningPercent, offset, cls: "true-recall-donut-learning" });
		}
	}

	return (
		<span
			class={`${DONUT_CLS}${extraCls ? ` ${extraCls}` : ""}`}
			aria-label={`Flashcards: ${info.new} new, ${info.learning} learning, ${info.dueToday} due today (${info.total} total)`}
			title={`Due: ${info.dueToday}, New: ${info.new}, Total: ${info.total}`}
			onClick={
				onPlay
					? (e) => {
							e.preventDefault();
							e.stopPropagation();
							onPlay();
						}
					: undefined
			}
		>
			<svg viewBox="0 0 36 36" class="true-recall-donut-svg">
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
		</span>
	);
}
