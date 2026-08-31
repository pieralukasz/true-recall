import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

import { useFormVariant } from "./FormVariantContext";

interface InfoBlockProps {
	children: ComponentChildren;
	class?: string;
	/**
	 * Lead line rendered above the body. Sections used to hand-roll this as a
	 * bold paragraph inside a bare div, which read as a heading without being
	 * one and picked up none of the surrounding spacing.
	 */
	title?: string;
}

export function InfoBlock({ children, class: cls, title }: InfoBlockProps) {
	const variant = useFormVariant();

	if (variant === "native") {
		// `tr-setting-note` supplies the margins Obsidian's
		// `.setting-item-description` lacks when it stands on its own between a
		// row and the next heading.
		return (
			<div class={cn("setting-item-description tr-setting-note", cls)}>
				{title && <strong class="tr-setting-note__title">{title}</strong>}
				{children}
			</div>
		);
	}

	return (
		<div
			class={cn(
				"ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:py-2",
				cls,
			)}
		>
			{title && (
				<span class="ep:block ep:mb-0.5 ep:font-medium ep:text-obs-normal">
					{title}
				</span>
			)}
			{children}
		</div>
	);
}
