import { cva } from "class-variance-authority";

import { cn } from "@true-recall/obsidian/utils/cn";

export type StatusPillTone = "neutral" | "accent" | "danger";

interface StatusPillProps {
	label: string;
	tone?: StatusPillTone;
	class?: string;
}

const statusPillVariants = cva(
	"ep:inline-flex ep:items-center ep:justify-center ep:whitespace-nowrap ep:rounded-full ep:px-2 ep:py-0.5 ep:text-ui-smaller ep:font-semibold ep:leading-tight",
	{
		variants: {
			tone: {
				neutral: "ep:bg-obs-modifier-hover ep:text-obs-muted",
				accent: "ep:bg-obs-interactive ep:text-obs-on-accent",
				danger: "ep:bg-obs-primary ep:text-obs-red",
			},
		},
		defaultVariants: { tone: "neutral" },
	},
);

export function StatusPill({
	label,
	tone = "neutral",
	class: cls,
}: StatusPillProps) {
	return <span class={cn(statusPillVariants({ tone }), cls)}>{label}</span>;
}
