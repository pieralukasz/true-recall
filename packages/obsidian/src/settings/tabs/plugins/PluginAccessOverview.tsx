import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import type { PluginTier, TrueRecallSettings } from "@true-recall/core/types";

import { Clickable, FormCard } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

interface AccessLevel {
	tier: PluginTier;
	name: string;
	subtitle: string;
	features: string[];
}

const ACCESS_LEVELS: AccessLevel[] = [
	{
		tier: "free",
		name: "Free",
		subtitle: "Local learning tools",
		features: [
			"Review, FSRS and dashboards",
			"Selection toolbar and status widgets",
			"No AI provider required",
		],
	},
	{
		tier: "byok",
		name: "BYOK / Local",
		subtitle: "Use your own model",
		features: [
			"Everything in Free",
			"Assistant, Flashcard Generator and Card Polish",
			"OpenRouter, LM Studio or a custom provider",
		],
	},
	{
		tier: "pro",
		name: "True Recall Pro",
		subtitle: "Managed AI and Pro plugins",
		features: [
			"Everything in BYOK",
			"Managed models, optimized prompts and included AI budget",
			"Image Occlusion, Type-in Mode and AI Anki Import",
		],
	},
];

function currentTier(settings: TrueRecallSettings): PluginTier {
	if (settings.proKey) return "pro";
	if (hasAIKey(settings)) return "byok";
	return "free";
}

export function PluginAccessOverview({
	settings,
}: {
	settings: TrueRecallSettings;
}) {
	const activeTier = currentTier(settings);

	return (
		<FormCard
			title="What each access level includes"
			description="Pro includes BYOK and Free. BYOK keeps model choice and billing with your provider."
		>
			<div class="tr-access-levels">
				{ACCESS_LEVELS.map((level) => {
					const isCurrent = level.tier === activeTier;
					return (
						<div
							key={level.tier}
							class={cn(
								"tr-access-level",
								`tr-access-level--${level.tier}`,
								isCurrent && "is-current",
							)}
						>
							<div class="tr-access-level__header">
								<div>
									<strong>{level.name}</strong>
									<span>{level.subtitle}</span>
								</div>
								{isCurrent ? (
									<span class="tr-access-level__current">Current</span>
								) : null}
							</div>
							<ul>
								{level.features.map((feature) => (
									<li key={feature}>{feature}</li>
								))}
							</ul>
							{level.tier === "pro" && activeTier !== "pro" ? (
								<Clickable
									class="tr-access-level__upgrade"
									onClick={() =>
										window.open("https://truerecall.com/pricing", "_blank")
									}
								>
									See Pro plans
								</Clickable>
							) : null}
						</div>
					);
				})}
			</div>
		</FormCard>
	);
}
