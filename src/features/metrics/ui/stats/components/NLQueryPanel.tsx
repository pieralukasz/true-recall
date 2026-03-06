import type { NLQueryService } from "@features/ai/services/nl-query.service";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import { TRUERECALL_WEB_URL } from "@shared/constants";
import type { ExampleQuery, NLQueryResult } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { useApp, usePlugin } from "@shared/ui/preact";
import { isFeatureAllowed } from "@shared/utils/subscription.utils";
import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const EXAMPLE_QUERIES: ExampleQuery[] = [
	{
		text: "Today's progress",
		query: "Summarize my learning progress for today",
	},
	{ text: "Weekly review", query: "How many cards did I review this week?" },
	{
		text: "Struggling cards",
		query: "Show me the top 10 cards with the most lapses",
	},
	{ text: "Success rate", query: "What is my average success rate?" },
	{
		text: "New cards/day",
		query: "How many new cards have I learned per day this month?",
	},
];

export function NLQueryPanel({
	nlQueryService,
}: {
	nlQueryService: NLQueryService | null;
}) {
	const app = useApp();
	const plugin = usePlugin();
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<NLQueryResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const resultsRef = useRef<HTMLDivElement>(null);

	const isReady = nlQueryService?.isReady() ?? false;
	const isTierGated =
		!isReady &&
		!!plugin.settings.subscriptionKey &&
		!isFeatureAllowed("nlQuery", plugin.settings);

	const submitQuery = useCallback(
		async (q: string) => {
			const trimmed = q.trim();
			if (!trimmed || !nlQueryService || isLoading) return;

			setIsLoading(true);
			setResult(null);
			setError(null);

			try {
				const res = await nlQueryService.query(trimmed);
				setResult(res);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setIsLoading(false);
			}
		},
		[nlQueryService, isLoading],
	);

	useEffect(() => {
		if (!result || !resultsRef.current) return;
		const answerEl = resultsRef.current.querySelector(".nl-answer-content");
		if (!answerEl || !(answerEl instanceof HTMLElement)) return;

		answerEl.empty();
		const obsComponent = new ObsidianComponent();
		void MarkdownRenderer.render(
			app,
			result.answer,
			answerEl,
			"",
			obsComponent,
		);
		return () => obsComponent.unload();
	}, [app, result]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void submitQuery(query);
			}
		},
		[query, submitQuery],
	);

	return (
		<StatsCard title="Learning Insights">
			<div class="ep:text-ui-small ep:text-obs-muted ep:mb-3">
				Explore your learning data with natural language questions.
			</div>

			{/* Input area */}
			<div class="ep:flex ep:gap-2 ep:mb-3 ep:items-end">
				<textarea
					class="ep:flex-1 ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:resize-none ep:focus:border-obs-interactive ep:focus:outline-none ep:placeholder:text-obs-faint"
					placeholder={
						isReady
							? "What would you like to know about your learning?"
							: isTierGated
								? "Upgrade to Starter to use Learning Insights"
								: "Add a subscription or OpenRouter API key in settings"
					}
					aria-label="Learning insights query"
					rows={2}
					value={query}
					onInput={(e) => setQuery((e.target as HTMLTextAreaElement).value)}
					onKeyDown={handleKeyDown}
				/>
				{isTierGated ? (
					<Clickable
						class="mod-cta ep:py-2 ep:px-4 ep:text-ui-small ep:rounded-md ep:transition-opacity ep:self-stretch"
						onClick={() =>
							window.open(`${TRUERECALL_WEB_URL}/pricing`, "_blank")
						}
					>
						Upgrade
					</Clickable>
				) : (
					<Clickable
						class="mod-cta ep:py-2 ep:px-4 ep:text-ui-small ep:rounded-md ep:transition-opacity ep:self-stretch"
						disabled={!isReady || isLoading}
						onClick={() => void submitQuery(query)}
					>
						{!isReady
							? "Not configured"
							: isLoading
								? "Analyzing..."
								: "Explore"}
					</Clickable>
				)}
			</div>

			{/* Example queries */}
			<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2">
				<span class="ep:text-ui-smaller ep:text-obs-muted">
					Quick insights:
				</span>
				{EXAMPLE_QUERIES.map((ex) => (
					<Clickable
						key={ex.text}
						class="ep:py-1 ep:px-3 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded-xl ep:bg-obs-primary ep:text-obs-muted ep:transition-all ep:hover:border-obs-interactive ep:hover:text-obs-normal"
						onClick={() => {
							setQuery(ex.query);
							void submitQuery(ex.query);
						}}
					>
						{ex.text}
					</Clickable>
				))}
			</div>

			{/* Results area */}
			<div ref={resultsRef} class="ep:mt-3 ep:empty:hidden">
				{isLoading && (
					<div class="ep:flex ep:items-center ep:gap-2 ep:text-obs-muted ep:italic">
						<span>Analyzing your question...</span>
					</div>
				)}

				{error && (
					<div class="ep:p-3 ep:bg-obs-red/10 ep:border ep:border-obs-red/30 ep:rounded-md ep:text-obs-red">
						<strong>Error: </strong>
						<span>{error}</span>
					</div>
				)}

				{result && !isLoading && (
					<div class="ep:bg-obs-primary ep:rounded-md ep:p-3">
						<div class="ep:text-ui-small ep:text-obs-muted ep:mb-2">
							<strong>Q: </strong>
							<span>{result.question}</span>
						</div>
						<div class="ep:text-ui-small ep:text-obs-normal">
							<strong>A: </strong>
							<div class="nl-answer-content ep:mt-1" />
						</div>

						{result.intermediateSteps.length > 0 && (
							<details class="ep:mt-3 ep:text-ui-smaller">
								<summary class="ep:text-obs-muted ep:cursor-pointer ep:py-1 ep:hover:text-obs-normal">
									Show SQL queries ({result.intermediateSteps.length})
								</summary>
								<div class="ep:mt-2">
									{result.intermediateSteps
										.filter((s) => s.action === "sql_db_query")
										.map((step, i) => (
											<div key={i} class="ep:mb-2">
												<code class="ep:block ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded-lg ep:font-mono ep:text-ui-smaller ep:whitespace-pre-wrap ep:break-all ep:text-obs-muted">
													{step.input}
												</code>
											</div>
										))}
								</div>
							</details>
						)}

						{result.error && (
							<div class="ep:mt-2 ep:text-ui-smaller ep:text-obs-orange">
								<span>Note: {result.error}</span>
							</div>
						)}
					</div>
				)}
			</div>
		</StatsCard>
	);
}
