import { Clickable } from "@true-recall/obsidian/components";

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
					<div class="ep:text-5xl ep:mb-4">&#127881;</div>
					<div class="ep:text-ui-medium ep:text-obs-muted ep:mb-6">
						{message}
					</div>
					<Clickable
						stopPropagation={false}
						class="ep-btn mod-cta"
						onClick={onClose}
					>
						Close
					</Clickable>
				</div>
			</div>
		</div>
	);
}
