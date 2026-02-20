export function OrphanedEmptyState() {
	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-12">
			<div class="ep:text-4xl ep:mb-4">✨</div>
			<div class="ep:text-obs-normal ep:text-ui-small ep:font-medium ep:mb-2">
				No orphaned cards!
			</div>
			<div class="ep:text-obs-muted ep:text-ui-smaller">
				All your flashcards are properly linked to source notes.
			</div>
		</div>
	);
}
