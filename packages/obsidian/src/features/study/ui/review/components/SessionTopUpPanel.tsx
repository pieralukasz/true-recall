import { useCallback, useEffect, useState } from "preact/hooks";

import type {
	ReviewSessionTopUp,
	ReviewSessionTopUpAvailability,
} from "@true-recall/core/types";

import { SessionTopUp } from "./SessionTopUp";

interface SessionTopUpPanelProps {
	getAvailability: () => ReviewSessionTopUpAvailability;
	onTopUp: (topUp: ReviewSessionTopUp) => Promise<boolean>;
}

export function SessionTopUpPanel({
	getAvailability,
	onTopUp,
}: SessionTopUpPanelProps) {
	const [availability, setAvailability] =
		useState<ReviewSessionTopUpAvailability | null>(null);
	const [availabilityFailed, setAvailabilityFailed] = useState(false);

	const refreshAvailability = useCallback(() => {
		try {
			setAvailability(getAvailability());
			setAvailabilityFailed(false);
		} catch (error) {
			console.error(
				"[True Recall] Could not check Top Up availability:",
				error,
			);
			setAvailabilityFailed(true);
		}
	}, [getAvailability]);

	useEffect(() => {
		const timeoutId = window.setTimeout(refreshAvailability, 0);
		return () => window.clearTimeout(timeoutId);
	}, [refreshAvailability]);

	const handleTopUp = async (topUp: ReviewSessionTopUp): Promise<boolean> => {
		const started = await onTopUp(topUp);
		if (!started) refreshAvailability();
		return started;
	};

	if (availabilityFailed) {
		return (
			<div class="ep:p-4 ep:text-ui-small ep:text-obs-red">
				Could not check Top Up availability. Please try again.
			</div>
		);
	}

	return availability ? (
		<SessionTopUp availability={availability} onTopUp={handleTopUp} />
	) : (
		<div class="ep:p-4 ep:text-ui-small ep:text-obs-muted">
			Checking available cards…
		</div>
	);
}
