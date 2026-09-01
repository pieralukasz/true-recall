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
		return (
			<div class={cn("tr-setting-section", cls)}>
				{(title || description) && (
					<div class="tr-setting-section__header">
						{title && (
							<h3 class="setting-item-heading tr-setting-section__title">
								{title}
							</h3>
						)}
						{description && (
							<div class="setting-item-description tr-setting-section__description">
								{description}
							</div>
						)}
					</div>
				)}
				<div class="tr-setting-section__body">{children}</div>
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
