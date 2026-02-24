import { ActionButton } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { formatEstimatedTime } from "../helpers/time-estimate";

interface SessionActionsProps {
	totalDue: number;
	totalOverdue: number;
	estimatedMinutes: number;
}

const QUICK_SESSION_MINUTES = 10;
const AVG_SECONDS_PER_CARD = 10;

export function SessionActions({
	totalDue,
	totalOverdue,
	estimatedMinutes,
}: SessionActionsProps) {
	const plugin = usePlugin();

	const quickCardLimit = Math.ceil(
		(QUICK_SESSION_MINUTES * 60) / AVG_SECONDS_PER_CARD,
	);

	const handleStartReview = () => {
		void plugin.openReviewViewWithFilters({ deckFilter: null });
	};

	const handleQuickReview = () => {
		void plugin.openReviewViewWithFilters({
			deckFilter: null,
			cardLimit: quickCardLimit,
		});
	};

	const handleClearOverdue = () => {
		void plugin.openReviewViewWithFilters({
			deckFilter: null,
			overdueOnly: true,
		});
	};

	const primaryLabel =
		totalDue > 0
			? `Start Review: ${totalDue} cards (~${formatEstimatedTime(estimatedMinutes)})`
			: "Start Review";

	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<ActionButton
				label={primaryLabel}
				variant="primary"
				onClick={handleStartReview}
				fullWidth
				disabled={totalDue === 0}
			/>
			<div class="ep:flex ep:gap-2">
				<ActionButton
					label={`Quick: ${QUICK_SESSION_MINUTES} min`}
					variant="secondary"
					onClick={handleQuickReview}
					fullWidth
					disabled={totalDue === 0}
					icon="zap"
				/>
				{totalOverdue > 0 && (
					<ActionButton
						label={`Clear Overdue (${totalOverdue})`}
						variant="secondary"
						onClick={handleClearOverdue}
						fullWidth
						icon="alert-triangle"
					/>
				)}
			</div>
		</div>
	);
}
