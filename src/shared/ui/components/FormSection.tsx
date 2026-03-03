import type { ComponentChildren } from "preact";

export interface FormSectionProps {
	title: string;
	description?: string;
	children?: ComponentChildren;
}

export function FormSection({ title, description, children }: FormSectionProps) {
	return (
		<div class="ep:pt-4 first:ep:pt-0">
			<div class="ep:mb-2">
				<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:uppercase ep:tracking-wider">
					{title}
				</span>
				{description && (
					<p class="ep:text-ui-smaller ep:text-obs-muted ep:mt-0.5">
						{description}
					</p>
				)}
			</div>
			{children}
		</div>
	);
}
