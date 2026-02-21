import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import type { NotePerformanceRow } from "@shared/types";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

type SortKey = "noteName" | "cardCount" | "retentionRate" | "avgLapses" | "lastReviewed";
type SortDir = "asc" | "desc";

interface NotePerformanceItem extends NotePerformanceRow {
	noteName: string;
	notePath: string;
}

function retentionClass(rate: number | null): string {
	if (rate === null) return "ep:text-obs-muted";
	if (rate >= 85) return "ep:text-[var(--color-green)]";
	if (rate >= 70) return "ep:text-[var(--color-orange)]";
	return "ep:text-[var(--color-red)]";
}

function formatDate(iso: string | null): string {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "2-digit",
	});
}

export function NotePerformanceTable({
	statsCalculator,
}: {
	statsCalculator: StatsCalculatorService;
}) {
	const plugin = usePlugin();
	const [rows, setRows] = useState<NotePerformanceItem[]>([]);
	const [sortKey, setSortKey] = useState<SortKey>("retentionRate");
	const [sortDir, setSortDir] = useState<SortDir>("asc");

	useEffect(() => {
		try {
			const raw = statsCalculator.getNotePerformance();
			const sourceNoteService =
				plugin.flashcardManager.getSourceNoteService();

			const enriched: NotePerformanceItem[] = [];
			for (const r of raw) {
				const resolved = sourceNoteService.resolveSourceNote(r.sourceUid);
				if (!resolved.noteName) continue; // orphaned source_uid
				enriched.push({
					...r,
					noteName: resolved.noteName,
					notePath: resolved.notePath ?? "",
				});
			}
			setRows(enriched);
		} catch (err) {
			console.error("Error fetching note performance:", err);
			setRows([]);
		}
	}, [statsCalculator, plugin]);

	const sorted = useMemo(() => {
		return [...rows].sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case "noteName":
					cmp = a.noteName.localeCompare(b.noteName);
					break;
				case "cardCount":
					cmp = a.cardCount - b.cardCount;
					break;
				case "retentionRate": {
					const ra = a.retentionRate ?? -1;
					const rb = b.retentionRate ?? -1;
					cmp = ra - rb;
					break;
				}
				case "avgLapses":
					cmp = a.avgLapses - b.avgLapses;
					break;
				case "lastReviewed": {
					const ta = a.lastReviewed ?? "";
					const tb = b.lastReviewed ?? "";
					cmp = ta.localeCompare(tb);
					break;
				}
			}
			return sortDir === "asc" ? cmp : -cmp;
		});
	}, [rows, sortKey, sortDir]);

	const handleSort = useCallback(
		(key: SortKey) => {
			if (key === sortKey) {
				setSortDir((d) => (d === "asc" ? "desc" : "asc"));
			} else {
				setSortKey(key);
				setSortDir("asc");
			}
		},
		[sortKey],
	);

	const openNote = useCallback(
		(notePath: string) => {
			plugin.app.workspace.openLinkText(notePath, "", false);
		},
		[plugin],
	);

	if (rows.length === 0) {
		return (
			<StatsCard title="Notes performance">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-32 ep:text-obs-muted ep:text-ui-small ep:italic">
					No source notes found
				</div>
			</StatsCard>
		);
	}

	const headers: { key: SortKey; label: string; align: string }[] = [
		{ key: "noteName", label: "Note", align: "ep:text-left" },
		{ key: "cardCount", label: "Cards", align: "ep:text-right" },
		{ key: "retentionRate", label: "Retention", align: "ep:text-right" },
		{ key: "avgLapses", label: "Avg lapses", align: "ep:text-right" },
		{ key: "lastReviewed", label: "Last review", align: "ep:text-right" },
	];

	return (
		<StatsCard title="Notes performance">
			<p class="ep:text-ui-smaller ep:text-obs-muted ep:mb-2">
				Worst retention first. Click column headers to sort, click row to open note.
			</p>
			<div class="ep:overflow-x-auto">
				<table class="ep:w-full ep:text-ui-small ep:border-collapse">
					<thead>
						<tr class="ep:border-b ep:border-obs-border">
							{headers.map(({ key, label, align }) => (
								<th
									key={key}
									class={`ep:py-1 ep:px-2 ep:font-medium ep:text-obs-muted ep:cursor-pointer ep:select-none ep:whitespace-nowrap ep:hover:text-obs-normal ${align}`}
									onClick={() => handleSort(key)}
								>
									{label}
									{sortKey === key && (
										<span class="ep:ml-0.5 ep:text-obs-faint">
											{sortDir === "asc" ? "↑" : "↓"}
										</span>
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{sorted.map((row) => (
							<tr
								key={row.sourceUid}
								class="ep:border-b ep:border-obs-border/50 ep:cursor-pointer ep:hover:bg-obs-secondary ep:transition-colors"
								onClick={() => openNote(row.notePath)}
							>
								<td class="ep:py-1.5 ep:px-2 ep:max-w-[200px] ep:truncate ep:font-medium">
									{row.noteName}
								</td>
								<td class="ep:py-1.5 ep:px-2 ep:text-right ep:tabular-nums">
									{row.cardCount}
								</td>
								<td
									class={`ep:py-1.5 ep:px-2 ep:text-right ep:tabular-nums ep:font-medium ${retentionClass(row.retentionRate)}`}
								>
									{row.retentionRate !== null ? `${row.retentionRate}%` : "—"}
								</td>
								<td class="ep:py-1.5 ep:px-2 ep:text-right ep:tabular-nums">
									{row.avgLapses.toFixed(1)}
								</td>
								<td class="ep:py-1.5 ep:px-2 ep:text-right ep:text-obs-muted">
									{formatDate(row.lastReviewed)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</StatsCard>
	);
}
