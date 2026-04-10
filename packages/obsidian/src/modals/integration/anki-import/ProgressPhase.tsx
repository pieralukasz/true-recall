interface ProgressPhaseProps {
	type: "parsing" | "importing" | "ai-classifying" | "ai-cleaning";
	progress?: string;
}

const LABELS: Record<string, { title: string; subtitle: string }> = {
	parsing: { title: "Parsing deck...", subtitle: "" },
	importing: {
		title: "Importing...",
		subtitle: "This may take a moment for large decks",
	},
	"ai-classifying": {
		title: "Classifying cards into decks...",
		subtitle: "AI is analyzing card content",
	},
	"ai-cleaning": {
		title: "Cleaning up content...",
		subtitle: "AI is fixing formatting issues",
	},
};

const FALLBACK = { title: "Importing...", subtitle: "" };

export function ProgressPhase({ type, progress }: ProgressPhaseProps) {
	const label = LABELS[type] ?? FALLBACK;

	return (
		<div class="ep:text-center ep:py-6">
			<div class="ep:text-ui-small ep:font-medium ep:mb-2">{label.title}</div>
			{(label.subtitle || progress) && (
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					{progress ?? label.subtitle}
				</div>
			)}
		</div>
	);
}
