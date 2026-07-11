import type { ComponentChildren } from "preact";
import { useErrorBoundary } from "preact/hooks";

import { Clickable } from "./Clickable";

interface ErrorBoundaryProps {
	children: ComponentChildren;
	fallbackMessage?: string;
}

export function ErrorBoundary({
	children,
	fallbackMessage = "Something went wrong",
}: ErrorBoundaryProps) {
	const [error, resetError] = useErrorBoundary((err) =>
		console.error("[True Recall] Render error:", err),
	) as [unknown, () => void];

	if (error) {
		return (
			<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-8 ep:gap-4 ep:text-center">
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					{fallbackMessage}
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:max-w-[300px]">
					{error instanceof Error
						? error.message
						: typeof error === "string"
							? error
							: JSON.stringify(error)}
				</div>
				<Clickable
					class="ep:py-2 ep:px-4 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-small ep:font-medium"
					onClick={resetError}
				>
					Try again
				</Clickable>
			</div>
		);
	}

	return <>{children}</>;
}
