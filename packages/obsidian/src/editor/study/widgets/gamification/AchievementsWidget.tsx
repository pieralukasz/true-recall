import { useComputed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";

import { configValue, parseCodeblockConfig } from "../config-parser";

interface AchievementDef {
	id: string;
	name: string;
	category: "streak" | "reviews" | "retention" | "collection";
	threshold: number;
	icon: string;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
	{
		id: "streak-7",
		name: "Week Warrior",
		category: "streak",
		threshold: 7,
		icon: "\uD83D\uDD25",
	},
	{
		id: "streak-30",
		name: "Monthly Master",
		category: "streak",
		threshold: 30,
		icon: "\uD83D\uDD25",
	},
	{
		id: "streak-100",
		name: "Century Streak",
		category: "streak",
		threshold: 100,
		icon: "\uD83D\uDD25",
	},
	{
		id: "streak-365",
		name: "Year of Learning",
		category: "streak",
		threshold: 365,
		icon: "\uD83D\uDD25",
	},
	{
		id: "rev-100",
		name: "Getting Started",
		category: "reviews",
		threshold: 100,
		icon: "\uD83D\uDCDA",
	},
	{
		id: "rev-500",
		name: "Dedicated Learner",
		category: "reviews",
		threshold: 500,
		icon: "\uD83D\uDCDA",
	},
	{
		id: "rev-1000",
		name: "Knowledge Seeker",
		category: "reviews",
		threshold: 1000,
		icon: "\uD83D\uDCDA",
	},
	{
		id: "rev-5000",
		name: "Review Machine",
		category: "reviews",
		threshold: 5000,
		icon: "\uD83D\uDCDA",
	},
	{
		id: "rev-10000",
		name: "Grand Master",
		category: "reviews",
		threshold: 10000,
		icon: "\uD83D\uDCDA",
	},
	{
		id: "ret-80",
		name: "Solid Foundation",
		category: "retention",
		threshold: 80,
		icon: "\uD83E\uDDE0",
	},
	{
		id: "ret-85",
		name: "Sharp Mind",
		category: "retention",
		threshold: 85,
		icon: "\uD83E\uDDE0",
	},
	{
		id: "ret-90",
		name: "Memory Palace",
		category: "retention",
		threshold: 90,
		icon: "\uD83E\uDDE0",
	},
	{
		id: "ret-95",
		name: "Total Recall",
		category: "retention",
		threshold: 95,
		icon: "\uD83E\uDDE0",
	},
	{
		id: "col-50",
		name: "Card Collector",
		category: "collection",
		threshold: 50,
		icon: "\uD83C\uDCCF",
	},
	{
		id: "col-100",
		name: "Deck Builder",
		category: "collection",
		threshold: 100,
		icon: "\uD83C\uDCCF",
	},
	{
		id: "col-500",
		name: "Library Builder",
		category: "collection",
		threshold: 500,
		icon: "\uD83C\uDCCF",
	},
	{
		id: "col-1000",
		name: "Knowledge Archive",
		category: "collection",
		threshold: 1000,
		icon: "\uD83C\uDCCF",
	},
];

interface ComputedAchievement extends AchievementDef {
	current: number;
	unlocked: boolean;
	progress: number;
}

function computeAchievements(
	statsCalc: StatsCalculatorService,
	totalCards: number,
): ComputedAchievement[] {
	const longestStreak = statsCalc.getStreakInfo().longest;

	const allStats = statsCalc.getAllDailyStats();
	const totalReviews = Object.values(allStats).reduce(
		(sum, s) => sum + s.reviewsCompleted,
		0,
	);

	const retention = statsCalc.getCollectionHealthSnapshot().averageRetention;

	return ACHIEVEMENT_DEFS.map((def) => {
		let current: number;
		switch (def.category) {
			case "streak":
				current = longestStreak;
				break;
			case "reviews":
				current = totalReviews;
				break;
			case "retention":
				current = retention;
				break;
			case "collection":
				current = totalCards;
				break;
		}

		return {
			...def,
			current,
			unlocked: current >= def.threshold,
			progress: Math.min(current / def.threshold, 1),
		};
	});
}

function sortAchievements(
	achievements: ComputedAchievement[],
): ComputedAchievement[] {
	return [...achievements].sort((a, b) => {
		if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
		if (a.unlocked && b.unlocked) return b.threshold - a.threshold;
		return b.progress - a.progress;
	});
}

export function AchievementsWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const achievements = useComputed((): ComputedAchievement[] | null => {
		void allMeta.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const totalCards = [...allMeta.value.values()].length;
		const all = computeAchievements(statsCalc, totalCards);

		const category = configValue(config, "category", "all");
		const filtered =
			category === "all" ? all : all.filter((a) => a.category === category);

		const showLocked = configValue(config, "showLocked", true);
		const visible = showLocked ? filtered : filtered.filter((a) => a.unlocked);

		const limit = configValue(config, "limit", 6);
		return sortAchievements(visible).slice(0, limit);
	}).value;

	if (!achievements) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	if (achievements.length === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				Start reviewing to earn achievements!
			</div>
		);
	}

	return (
		<div class="ep:grid ep:grid-cols-2 ep:gap-2 ep:p-3">
			{achievements.map((a) => (
				<div
					key={a.id}
					class={`ep:flex ep:gap-2 ep:p-2 ep:rounded ep:text-xs ${
						a.unlocked ? "ep:bg-obs-green/5" : "ep:opacity-60"
					}`}
					title={
						a.unlocked ? `${a.name} - Earned!` : `${a.current}/${a.threshold}`
					}
				>
					<span class="ep:text-base ep:leading-none">{a.icon}</span>
					<div class="ep:flex ep:flex-col ep:flex-1 ep:min-w-0">
						<div class="ep:flex ep:items-center ep:justify-between ep:gap-1">
							<span class="ep:truncate ep:font-medium">{a.name}</span>
							{a.unlocked ? (
								<span class="ep:text-obs-green ep:shrink-0">&#10003;</span>
							) : (
								<span class="ep:text-obs-muted ep:shrink-0">
									{Math.round(a.progress * 100)}%
								</span>
							)}
						</div>
						{!a.unlocked && (
							<>
								<div class="ep:h-1.5 ep:rounded-full ep:bg-obs-modifier-border ep:mt-1">
									<div
										class="ep:h-full ep:rounded-full"
										style={{
											width: `${a.progress * 100}%`,
											backgroundColor: "var(--color-blue)",
										}}
									/>
								</div>
								<span class="ep:text-obs-muted ep:mt-0.5">
									{a.current}/{a.threshold}
								</span>
							</>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
