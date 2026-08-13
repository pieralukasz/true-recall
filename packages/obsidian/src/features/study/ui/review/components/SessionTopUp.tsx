import { useState } from "preact/hooks";

import type {
	ReviewSessionTopUp,
	ReviewSessionTopUpAvailability,
} from "@true-recall/core/types";

import { ActionButton, SelectInput } from "@true-recall/obsidian/components";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { cn } from "@true-recall/obsidian/utils/cn";

interface SessionTopUpProps {
	availability: ReviewSessionTopUpAvailability;
	onTopUp: (topUp: ReviewSessionTopUp) => Promise<boolean>;
}

const TOP_UP_OPTIONS: Array<{
	value: ReviewSessionTopUp["kind"];
	label: string;
}> = [
	{ value: "review", label: "Review" },
	{ value: "new", label: "New" },
];

const AVAILABILITY_STYLES = {
	review: FSRS_COLORS.review,
	new: FSRS_COLORS.new,
};

function AvailabilityPill({
	kind,
	count,
}: {
	kind: ReviewSessionTopUp["kind"];
	count: number;
}) {
	const isAvailable = count > 0;
	return (
		<div
			class={cn(
				"ep:inline-flex ep:items-center ep:gap-2 ep:rounded-full ep:border ep:border-solid ep:px-2.5 ep:py-1 ep:text-ui-smaller",
				isAvailable
					? AVAILABILITY_STYLES[kind].chipCls
					: "ep:border-obs-border ep:bg-obs-primary ep:text-obs-faint",
			)}
		>
			<span>{kind === "review" ? "Review" : "New"}</span>
			<span class="ep:font-semibold ep:tabular-nums">{count}</span>
		</div>
	);
}

export function SessionTopUp({ availability, onTopUp }: SessionTopUpProps) {
	const [kind, setKind] = useState<ReviewSessionTopUp["kind"]>(() =>
		availability.review > 0 ? "review" : "new",
	);
	const [count, setCount] = useState("5");
	const [isStarting, setIsStarting] = useState(false);
	const requestedCount = Number.parseInt(count, 10);
	const available = availability[kind];
	const canStart =
		!isStarting &&
		available > 0 &&
		Number.isFinite(requestedCount) &&
		requestedCount > 0;

	const handleTopUp = async () => {
		if (!canStart) return;
		setIsStarting(true);
		try {
			const started = await onTopUp({ kind, count: requestedCount });
			if (!started) setIsStarting(false);
		} catch (error) {
			setIsStarting(false);
			throw error;
		}
	};

	if (availability.review === 0 && availability.new === 0) {
		return (
			<div class="ep:rounded-lg ep:border ep:border-solid ep:border-obs-border ep:bg-obs-secondary ep:p-4 ep:text-ui-small ep:text-obs-muted">
				No more Review or New cards are available for Top Up.
			</div>
		);
	}

	return (
		<div class="ep:rounded-lg ep:border ep:border-solid ep:border-obs-border ep:bg-obs-secondary ep:p-4 ep:text-left">
			<div class="ep:mb-3 ep:text-ui-small ep:font-semibold ep:text-obs-normal">
				Top Up
			</div>
			<div class="ep:mb-4 ep:flex ep:flex-wrap ep:items-center ep:gap-2">
				<span class="ep:mr-1 ep:text-ui-smaller ep:uppercase ep:tracking-wide ep:text-obs-faint">
					Available
				</span>
				<AvailabilityPill kind="review" count={availability.review} />
				<AvailabilityPill kind="new" count={availability.new} />
			</div>
			<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2">
				<SelectInput
					value={kind}
					onChange={(value) => setKind(value as ReviewSessionTopUp["kind"])}
					options={TOP_UP_OPTIONS.map((option) => ({
						...option,
						disabled: availability[option.value] === 0,
					}))}
					ariaLabel="Top Up card type"
				/>
				<input
					type="number"
					min={1}
					step={1}
					inputMode="numeric"
					autoComplete="off"
					name="top-up-card-count"
					value={count}
					aria-label="Top Up card count"
					class="ep:w-16 ep:shrink-0 ep:rounded-md ep:border ep:border-solid ep:border-obs-border ep:bg-obs-primary ep:px-2 ep:py-1 ep:text-center ep:text-ui-small ep:text-obs-normal"
					onInput={(event) =>
						setCount((event.target as HTMLInputElement).value)
					}
					onKeyDown={(event) => {
						if (event.key === "Enter") void handleTopUp();
					}}
				/>
				<ActionButton
					label={isStarting ? "Starting…" : "Top up"}
					onClick={() => void handleTopUp()}
					variant="primary"
					size="sm"
					icon="plus"
					class="ep:min-h-9 ep:px-3"
					disabled={!canStart}
				/>
			</div>
			{requestedCount > available && available > 0 ? (
				<div class="ep:mt-2 ep:text-center ep:text-ui-smaller ep:text-obs-muted">
					Only {available} cards are available; all of them will be added.
				</div>
			) : null}
		</div>
	);
}
