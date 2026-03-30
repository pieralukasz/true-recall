import { useComputed } from "@preact/signals";
import { allCardsArray, cards } from "@shared/services/reactive-card-store";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";

interface CountdownData {
	daysRemaining: number;
	label: string;
	readiness: number;
	totalCards: number;
	cardsAtTarget: number;
	cardsAtRisk: number;
	newCardsRemaining: number;
	urgency: "relaxed" | "normal" | "urgent" | "critical";
}

const URGENCY_COLORS: Record<string, string> = {
	relaxed: "var(--color-blue)",
	normal: "var(--text-normal)",
	urgent: "var(--color-orange)",
	critical: "var(--color-red)",
};

export function CountdownWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const dateStr = configValue(config, "date", "") as string;

	const data = useComputed((): CountdownData | null => {
		void cards.value;
		if (!dateStr) return null;

		const targetDate = new Date(dateStr);
		const targetRetention = (configValue(config, "target", 90) as number) / 100;
		const label = configValue(config, "label", "Exam") as string;

		const allCards = allCardsArray.value;
		const daysRemaining = Math.ceil(
			(targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);

		let cardsAtTarget = 0;
		let cardsAtRisk = 0;
		let newCards = 0;

		for (const card of allCards) {
			if (card.fsrs.suspended) continue;
			if (card.fsrs.state === State.New) {
				newCards++;
				continue;
			}

			const predictedR = plugin.fsrsService.getRetrievability(
				card.fsrs,
				targetDate,
			);
			if (predictedR >= targetRetention) cardsAtTarget++;
			else cardsAtRisk++;
		}

		const reviewed = cardsAtTarget + cardsAtRisk;
		const readiness =
			reviewed > 0 ? Math.round((cardsAtTarget / reviewed) * 100) : 0;

		let urgency: CountdownData["urgency"];
		if (daysRemaining <= 0) urgency = "critical";
		else if (daysRemaining <= 7) urgency = "urgent";
		else if (daysRemaining <= 30) urgency = "normal";
		else urgency = "relaxed";

		return {
			daysRemaining,
			label,
			readiness,
			totalCards: allCards.length,
			cardsAtTarget,
			cardsAtRisk,
			newCardsRemaining: newCards,
			urgency,
		};
	}).value;

	if (!dateStr) {
		return (
			<div class="ep:flex ep:flex-col ep:gap-1.5 ep:p-3 ep:text-xs ep:text-obs-muted">
				<span>Configure a target date:</span>
				<pre class="ep:m-0 ep:p-2 ep:rounded ep:bg-obs-modifier-hover ep:text-xs ep:font-mono">
					{`date: 2026-06-15\nlabel: Final Exam\ntarget: 90`}
				</pre>
			</div>
		);
	}

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	if (data.totalCards === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				Add flashcards to track readiness
			</div>
		);
	}

	const readinessColor =
		data.readiness >= 80
			? "var(--color-green)"
			: data.readiness >= 50
				? "var(--color-orange)"
				: "var(--color-red)";

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Header: label + days */}
			<div class="ep:flex ep:items-baseline ep:justify-between">
				<span class="ep:font-semibold ep:text-xs">{data.label}</span>
				<div class="ep:flex ep:items-baseline ep:gap-1">
					<span
						class="ep:text-xl ep:font-bold ep:leading-none"
						style={{ color: URGENCY_COLORS[data.urgency] }}
					>
						{formatDaysLabel(data.daysRemaining)}
					</span>
					<span class="ep:text-xs ep:text-obs-muted">
						{formatDaysSuffix(data.daysRemaining)}
					</span>
				</div>
			</div>

			{/* Readiness bar */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
					<span>Readiness</span>
					{data.readiness === 100 ? (
						<span
							class="ep:font-semibold"
							style={{ color: "var(--color-green)" }}
						>
							Ready!
						</span>
					) : (
						<span class="ep:font-semibold">{data.readiness}%</span>
					)}
				</div>
				<div class="ep:h-2.5 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden">
					<div
						class="ep:h-full ep:rounded ep:transition-all"
						style={{
							width: `${data.readiness}%`,
							backgroundColor: readinessColor,
						}}
					/>
				</div>
			</div>

			{/* Stats row */}
			<div class="ep:flex ep:items-center ep:gap-1.5 ep:text-xs ep:flex-wrap">
				<span style={{ color: "var(--color-green)" }}>
					{data.cardsAtTarget} ready
				</span>
				{data.cardsAtRisk > 0 && (
					<>
						<span class="ep:text-obs-faint">·</span>
						<span style={{ color: "var(--color-orange)" }}>
							{data.cardsAtRisk} at risk
						</span>
					</>
				)}
				{data.newCardsRemaining > 0 && (
					<>
						<span class="ep:text-obs-faint">·</span>
						<span>{data.newCardsRemaining} new</span>
					</>
				)}
			</div>

			{/* CTA */}
			{data.cardsAtRisk > 0 && (
				<div class="ep:flex ep:justify-end">
					<WidgetCta
						label="Review at-risk cards →"
						onClick={() => void plugin.openCustomStudyModal().catch(() => {})}
					/>
				</div>
			)}
		</div>
	);
}

function formatDaysLabel(days: number): string {
	if (days <= 0 && days > -1) return "Today!";
	if (days < 0) return String(Math.abs(days));
	return String(days);
}

function formatDaysSuffix(days: number): string {
	if (days <= 0 && days > -1) return "";
	if (days < 0) {
		const absDays = Math.abs(days);
		return absDays === 1 ? "day ago" : "days ago";
	}
	return days === 1 ? "day" : "days";
}
