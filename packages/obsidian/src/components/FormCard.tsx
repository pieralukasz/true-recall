import { cn } from "@true-recall/obsidian/utils";
import type { ComponentChildren } from "preact";

export interface FormCardProps {
	title?: string;
	description?: string;
	children: ComponentChildren;
	class?: string;
}

export function FormCard({
	title,
	description,
	children,
	class: cls,
}: FormCardProps) {
	return (
		<div class={cn("ep:p-4 ep:rounded-lg ep:bg-surface-raised", cls)}>
			{title && (
				<div class="ep:flex ep:items-center ep:justify-between ep:mb-3 ep:pb-2.5 ep:border-b ep:border-obs-border">
					<div>
						<span class="ep:ep-text-heading-md">{title}</span>
						{description && (
							<p class="ep:ep-text-caption ep:mt-0.5">{description}</p>
						)}
					</div>
				</div>
			)}
			{children}
		</div>
	);
}
