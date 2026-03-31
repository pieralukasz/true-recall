export interface ProgressPhaseProps {
	type: "parsing" | "importing";
}

export function ProgressPhase({ type }: ProgressPhaseProps) {
	if (type === "parsing") {
		return <div class="ep:text-center ep:py-6">Parsing deck...</div>;
	}

	return (
		<div class="ep:text-center ep:py-6">
			<div class="ep:text-ui-small ep:font-medium ep:mb-2">Importing...</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">
				This may take a moment for large decks
			</div>
		</div>
	);
}
