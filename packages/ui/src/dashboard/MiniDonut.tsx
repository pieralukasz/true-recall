import { FSRS_COLORS } from "../helpers/fsrs-colors";

const CIRCUMFERENCE = 100;
const RADIUS = 15.91549430918954;
const STROKE_WIDTH = 5;

interface MiniDonutProps {
	due: number;
	newCount: number;
	learning: number;
	total: number;
}

export function MiniDonut({ due, newCount, learning, total }: MiniDonutProps) {
	const segments: { length: number; offset: number; stroke: string }[] = [];
	let offset = 0;

	if (total > 0) {
		const duePercent = (due / total) * CIRCUMFERENCE;
		const newPercent = (newCount / total) * CIRCUMFERENCE;
		const learningPercent = (learning / total) * CIRCUMFERENCE;

		if (duePercent > 0) {
			segments.push({
				length: duePercent,
				offset,
				stroke: `var(${FSRS_COLORS.review.cssVar})`,
			});
			offset += duePercent;
		}
		if (newPercent > 0) {
			segments.push({
				length: newPercent,
				offset,
				stroke: `var(${FSRS_COLORS.new.cssVar})`,
			});
			offset += newPercent;
		}
		if (learningPercent > 0) {
			segments.push({
				length: learningPercent,
				offset,
				stroke: `var(${FSRS_COLORS.learning.cssVar})`,
			});
		}
	}

	return (
		<svg
			viewBox="0 0 36 36"
			width="14"
			height="14"
			class="ep:shrink-0 ep:block"
			role="img"
			aria-label="Progress"
		>
			<circle
				cx={18}
				cy={18}
				r={RADIUS}
				fill="none"
				stroke-width={STROKE_WIDTH}
				class="true-recall-donut-bg"
			/>
			{segments.map((seg, _i) => (
				<circle
					key={seg.stroke}
					cx={18}
					cy={18}
					r={RADIUS}
					fill="none"
					stroke-width={STROKE_WIDTH}
					class="true-recall-donut-segment"
					stroke={seg.stroke}
					stroke-dasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
					stroke-dashoffset={25 - seg.offset}
				/>
			))}
		</svg>
	);
}
