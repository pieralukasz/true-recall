import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";

export function StudyNowButton({ dueCount }: { dueCount: number }) {
	const plugin = usePlugin();

	const handleStudy = () => {
		void plugin.openReviewViewWithFilters({ deckFilter: null });
	};

	return (
		<Clickable
			class="ep:shrink-0 ep:py-3 ep:px-6 ep:rounded-lg ep:bg-obs-interactive ep:text-obs-on-interactive ep:text-center ep:font-semibold ep:text-base ep:transition-all ep:duration-200 ep:hover:opacity-90 ep:self-center"
			onClick={handleStudy}
		>
			<div class="ep:flex ep:flex-col ep:items-center ep:gap-1">
				<span>Study Now</span>
				{dueCount > 0 && (
					<span class="ep:text-xs ep:font-normal ep:opacity-80">
						{dueCount} card{dueCount !== 1 ? "s" : ""} due
					</span>
				)}
			</div>
		</Clickable>
	);
}
