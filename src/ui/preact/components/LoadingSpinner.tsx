export interface LoadingSpinnerProps {
	message?: string;
	subMessage?: string;
}

export function LoadingSpinner({
	message = "Loading...",
	subMessage,
}: LoadingSpinnerProps) {
	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-6 ep:px-2 ep:gap-3">
			<div class="ep:text-obs-interactive">
				<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
					<circle
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="3"
						fill="none"
						stroke-dasharray="31.4 31.4"
						stroke-linecap="round"
					>
						<animateTransform
							attributeName="transform"
							type="rotate"
							dur="1s"
							from="0 12 12"
							to="360 12 12"
							repeatCount="indefinite"
						/>
					</circle>
				</svg>
			</div>
			<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{message}
			</div>
			{subMessage && (
				<div class="ep:text-ui-smaller ep:text-obs-muted">{subMessage}</div>
			)}
		</div>
	);
}
