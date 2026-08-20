interface ReviewUserCommentProps {
	comment?: string;
	onEdit: () => void;
	onRemove: () => void;
}

export function ReviewUserComment({
	comment,
	onEdit,
	onRemove,
}: ReviewUserCommentProps) {
	if (!comment) return null;

	return (
		<div class="true-recall-review-user-comment ep:shrink-0 ep:px-4 ep:pb-2">
			<div class="true-recall-review-user-comment-card">
				<button
					type="button"
					onClick={onEdit}
					class="true-recall-review-user-comment-edit"
					title="Edit note (Cmd/Ctrl+K)"
				>
					<span class="ep:block ep:max-h-20 ep:min-w-0 ep:overflow-hidden ep:break-words ep:whitespace-pre-wrap ep:text-ui-small ep:leading-relaxed ep:text-obs-normal">
						{comment}
					</span>
				</button>
				<button
					type="button"
					onClick={onRemove}
					class="true-recall-review-user-comment-remove"
					aria-label="Remove note"
					title="Remove note"
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>
		</div>
	);
}
