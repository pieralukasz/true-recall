import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

import { useFormVariant } from "./FormVariantContext";

interface FormCardProps {
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
	const variant = useFormVariant();

	if (variant === "native") {
		// `tr-setting-section` is what settings.styles.css hangs the section
		// rhythm off. Obsidian's own heading spacing relies on a sibling
		// adjacency that never matches once a heading is wrapped like this.
		return (
			<div class={cn("tr-setting-section", cls)}>
				{title && <div class="setting-item setting-item-heading">{title}</div>}
				{description && (
					<div class="setting-item-description tr-setting-note">
						{description}
					</div>
				)}
				{children}
			</div>
		);
	}

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
