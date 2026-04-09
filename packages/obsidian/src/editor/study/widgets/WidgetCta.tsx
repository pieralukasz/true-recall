import { cva, type VariantProps } from "class-variance-authority";

import { Clickable } from "@true-recall/obsidian/components";

const widgetCtaVariants = cva(
	"ep:inline-flex ep:items-center ep:justify-center ep:text-xs ep:px-2 ep:py-0.5 ep:rounded ep:transition-colors",
	{
		variants: {
			variant: {
				primary:
					"ep:bg-obs-interactive-accent ep:text-obs-on-accent hover:ep:opacity-90",
				secondary:
					"ep:border ep:border-obs-modifier-border hover:ep:bg-obs-modifier-hover",
			},
		},
		defaultVariants: { variant: "primary" },
	},
);

export interface WidgetCtaProps extends VariantProps<typeof widgetCtaVariants> {
	label: string;
	onClick: () => void;
	class?: string;
}

export function WidgetCta({
	label,
	onClick,
	variant,
	class: cls,
}: WidgetCtaProps) {
	return (
		<Clickable
			onClick={onClick}
			class={widgetCtaVariants({ variant, className: cls })}
		>
			{label}
		</Clickable>
	);
}
