export function ReviewEmptyState({
	message,
	onClose,
}: {
	message: string;
	onClose: () => void;
}) {
	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto">
				<div class="ep:text-center ep:py-12 ep:px-6">
					<div class="ep:text-5xl ep:mb-4">🎉</div>
					<div class="ep:text-ui-medium ep:text-obs-muted ep:mb-6">
						{message}
					</div>
					<button
						type="button"
						class="ep:flex ep:flex-col ep:items-center ep:gap-1 ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small mod-cta"
						onClick={onClose}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
