import { TRUERECALL_PRICING_URL } from "@true-recall/core/constants";
import type { PluginTier, TrueRecallSettings } from "@true-recall/core/types";
import { withPluginUtm } from "@true-recall/core/utils";

import { FormCard } from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";
import { resolveAccessTier } from "@true-recall/obsidian/plugin/plugin-utils";
import { cn } from "@true-recall/obsidian/utils/cn";

interface AccessLevel {
	tier: PluginTier;
	name: string;
	subtitle: string;
	includes: string;
}

const ACCESS_LEVELS: AccessLevel[] = [
	{
		tier: "free",
		get name() {
			return t("Free");
		},
		subtitle: "Local learning tools",
		includes: "Review, FSRS, dashboards and Quick Actions — no AI required.",
	},
	{
		tier: "byok",
		get name() {
			return t("BYOK / Local");
		},
		subtitle: "Use your own model",
		includes:
			"Everything in Free, plus AI Workspace with OpenRouter, LM Studio or a custom provider.",
	},
	{
		tier: "pro",
		get name() {
			return t("True Recall Pro");
		},
		subtitle: "Managed AI and advanced review tools",
		includes:
			"Everything in BYOK, plus managed AI, included budget, Image Occlusion and typed-answer grading.",
	},
];

export function PluginAccessOverview({
	settings,
}: {
	settings: TrueRecallSettings;
}) {
	const activeTier = resolveAccessTier(settings);

	return (
		<FormCard
			title={t("Access levels")}
			description={t(
				"Pro includes BYOK and Free. With BYOK, model choice and billing stay with your provider.",
			)}
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
							<div class="tr-access-level__identity">
								<strong>{level.name}</strong>
								<span>{level.subtitle}</span>
							</div>
							<p class="tr-access-level__includes">{level.includes}</p>
							{isCurrent ? (
								<span class="tr-access-level__current">{t("Current")}</span>
							) : null}
							{level.tier === "pro" && activeTier !== "pro" ? (
								<a
									class="tr-access-level__upgrade"
									href={withPluginUtm(
										TRUERECALL_PRICING_URL,
										"settings-plugins",
									)}
									target="_blank"
									rel="noreferrer"
								>
									{t("View plans")}
								</a>
							) : null}
						</div>
					);
				})}
			</div>
		</FormCard>
	);
}
