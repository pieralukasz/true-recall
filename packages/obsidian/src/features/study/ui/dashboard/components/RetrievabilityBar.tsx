import { describeRetrievability } from "@true-recall/core/helpers/note-priority";
import type { NoteRetrievability } from "@true-recall/core/types/dashboard.types";

interface RetrievabilityBarProps {
	spread?: NoteRetrievability;
}

/** Compact, non-prescriptive memory map for a project or note. */
export function RetrievabilityBar({ spread }: RetrievabilityBarProps) {
	const total = spread?.total ?? 0;
	const description = describeRetrievability(spread) ?? "No review cards";

	return (
		<span
			role="img"
			aria-label={description.replaceAll("\n", ". ")}
			class="ep:flex ep:w-20 ep:h-1.5 ep:shrink-0 ep:overflow-hidden ep:rounded-full ep:bg-obs-secondary"
		>
			{total > 0 && spread && (
				<>
					{spread.urgent > 0 && (
						<span
							class="ep:h-full ep:bg-obs-red"
							style={{ width: `${(spread.urgent / total) * 100}%` }}
						/>
					)}
					{spread.losing > 0 && (
						<span
							class="ep:h-full ep:bg-obs-orange"
							style={{ width: `${(spread.losing / total) * 100}%` }}
						/>
					)}
					{spread.known > 0 && (
						<span
							class="ep:h-full ep:bg-obs-blue"
							style={{ width: `${(spread.known / total) * 100}%` }}
						/>
					)}
					{spread.fresh > 0 && (
						<span
							class="ep:h-full ep:bg-obs-green"
							style={{ width: `${(spread.fresh / total) * 100}%` }}
						/>
					)}
				</>
			)}
		</span>
	);
}
