import type { ComponentChildren } from "preact";

interface FormSectionProps {
	title: string;
	description?: string;
	children?: ComponentChildren;
}

function FormSection({
	title,
	description,
	children,
}: FormSectionProps) {
	return (
		<div class="ep:pt-4 first:ep:pt-0">
			<div class="ep:mb-2">
				<span class="ep:ep-text-heading-sm">{title}</span>
				{description && (
					<p class="ep:ep-text-caption ep:mt-0.5">{description}</p>
				)}
			</div>
			{children}
		</div>
	);
}
