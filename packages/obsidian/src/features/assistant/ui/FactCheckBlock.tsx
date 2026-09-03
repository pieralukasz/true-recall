import type {
	FactCheckResult,
	FactCheckVerdict,
} from "@true-recall/core/ai/assistant";

import { cn } from "@true-recall/obsidian/utils/cn";

const VERDICT_LABEL: Record<FactCheckVerdict, string> = {
	confirmed: "Confirmed",
	incorrect: "Incorrect",
	outdated: "Outdated",
	unverifiable: "Unverifiable",
};

/** Badge colors use Obsidian theme variables so they follow light and dark themes. */
const VERDICT_CLASS: Record<FactCheckVerdict, string> = {
	confirmed: "ep:bg-obs-green ep:text-obs-on-accent",
	incorrect: "ep:bg-obs-red ep:text-obs-on-accent",
	outdated: "ep:bg-obs-orange ep:text-obs-on-accent",
	unverifiable: "ep:bg-obs-modifier-hover ep:text-obs-muted",
};

function hostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** Verdict, confidence, reasoning and evidence of a fact-check task. */
export function FactCheckBlock({ result }: { result: FactCheckResult }) {
	return (
		<section class="tr-card-ai-preview-section" data-testid="fact-check-block">
			<h5 class="tr-card-ai-preview-column-title">Fact check</h5>
			<div class="ep:flex ep:items-center ep:gap-2">
				<span
					class={cn(
						"ep:inline-flex ep:items-center ep:rounded-full ep:px-2 ep:py-0.5 ep:text-ui-smaller ep:font-semibold ep:leading-tight",
						VERDICT_CLASS[result.verdict],
					)}
				>
					{VERDICT_LABEL[result.verdict]}
				</span>
				<span class="ep:text-ui-smaller ep:text-obs-muted">
					{result.confidence} confidence
				</span>
			</div>
			<p class="ep:m-0 ep:mt-2 ep:text-ui-small ep:text-obs-normal ep:leading-normal">
				{result.summary}
			</p>
			{result.evidence.length > 0 ? (
				<ul class="ep:m-0 ep:mt-2 ep:list-none ep:p-0 ep:flex ep:flex-col ep:gap-1.5">
					{result.evidence.map((item) => (
						<li
							key={item.url}
							class="ep:py-1 ep:px-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-surface-raised"
						>
							<a
								class="ep:block ep:truncate ep:text-ui-smaller"
								href={item.url}
								rel="noopener"
							>
								{item.title ?? hostname(item.url)}
							</a>
							{item.quote ? (
								<div class="ep:mt-0.5 ep:text-ui-smaller ep:italic ep:text-obs-muted">
									{item.quote}
								</div>
							) : null}
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
