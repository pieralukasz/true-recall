import { useSignal } from "@preact/signals";
import { effect } from "@preact/signals-core";
import { Chart, type ChartDataset } from "chart.js";
import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { StatsCalculatorService } from "../../services";
import type { NLQueryService } from "../../services/ai/nl-query.service";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	track,
} from "../../services/core/signals";
import type {
	CardMaturityBreakdown,
	CardsCreatedVsReviewedEntry,
	ExampleQuery,
	FSRSFlashcardItem,
	FutureDueEntry,
	NLQueryResult,
	RetentionEntry,
	StatsTimeRange,
} from "../../types";
import { CardPreviewModal } from "../modals";
import { useApp, usePlugin } from "../preact";
import { getThemeColor, getThemeColorWithAlpha } from "../utils/theme-colors";

// ─── Helpers ────────────────────────────────────────────────────────

function formatDateLabel(isoDate: string): string {
	const date = new Date(isoDate);
	return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatDateForDisplay(isoDate: string): string {
	const date = new Date(isoDate);
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function getMaxTicksForRange(range: StatsTimeRange): number {
	switch (range) {
		case "1y":
			return 12;
		case "3m":
			return 13;
		case "1m":
			return 15;
		default:
			return 30;
	}
}

// ─── StatsCard ──────────────────────────────────────────────────────

interface StatsCardProps {
	title?: string;
	hoverLift?: boolean;
	children: preact.ComponentChildren;
}

function StatsCard({ title, hoverLift = true, children }: StatsCardProps) {
	return (
		<div
			class={[
				"ep:mb-5 ep:p-5 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200",
				hoverLift ? "ep:hover:-translate-y-px" : "",
			].join(" ")}
		>
			{title && (
				<div class="ep:flex ep:items-center ep:justify-between ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border">
					<span class="ep:text-ui-large ep:font-semibold ep:text-obs-normal ep:tracking-tight">
						{title}
					</span>
				</div>
			)}
			{children}
		</div>
	);
}

// ─── ChartCard ──────────────────────────────────────────────────────

interface ChartCardProps {
	title: string;
	buildChart: (canvas: HTMLCanvasElement) => Chart;
	updateChart?: (chart: Chart) => void;
	deps: unknown[];
	emptyMessage?: string;
	isEmpty?: boolean;
	children?: preact.ComponentChildren;
	aboveCanvas?: preact.ComponentChildren;
}

function ChartCard({
	title,
	buildChart,
	updateChart,
	deps,
	emptyMessage,
	isEmpty,
	children,
	aboveCanvas,
}: ChartCardProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart | null>(null);

	// Destroy chart on unmount
	useEffect(() => {
		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, []);

	// Build or update chart when deps change
	useEffect(() => {
		if (isEmpty) {
			chartRef.current?.destroy();
			chartRef.current = null;
			return;
		}
		if (!canvasRef.current) return;

		if (chartRef.current && updateChart) {
			updateChart(chartRef.current);
		} else {
			chartRef.current?.destroy();
			chartRef.current = buildChart(canvasRef.current);
		}
	}, deps);

	return (
		<StatsCard title={title}>
			{isEmpty ? (
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					{emptyMessage || "No data available"}
				</div>
			) : (
				<>
					{aboveCanvas}
					<div class="ep:w-full ep:h-52 ep:relative">
						<canvas ref={canvasRef} class="true-recall-chart-fade-in" />
					</div>
					{children}
				</>
			)}
		</StatsCard>
	);
}

// ─── SummaryList ────────────────────────────────────────────────────

function SummaryList({ items }: { items: string[] }) {
	if (items.length === 0) return null;
	return (
		<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border ep:flex ep:flex-col ep:gap-1.5">
			{items.map((item, i) => (
				<div
					key={i}
					class="ep:text-ui-small ep:text-obs-muted ep:flex ep:items-center ep:gap-2"
				>
					<div class="ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-interactive ep:shrink-0" />
					<span>{item}</span>
				</div>
			))}
		</div>
	);
}

// ─── NLQueryPanel ───────────────────────────────────────────────────

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

function NLQueryPanel({
	nlQueryService,
}: {
	nlQueryService: NLQueryService | null;
}) {
	const app = useApp();
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<NLQueryResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const resultsRef = useRef<HTMLDivElement>(null);

	const isReady = nlQueryService?.isReady() ?? false;

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

	// Render markdown answer via Obsidian's MarkdownRenderer
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
							: "Configure OpenRouter API key in settings to enable AI queries"
					}
					aria-label="Learning insights query"
					rows={2}
					value={query}
					onInput={(e) => setQuery((e.target as HTMLTextAreaElement).value)}
					onKeyDown={handleKeyDown}
				/>
				<button
					type="button"
					class="mod-cta ep:py-2 ep:px-4 ep:text-ui-small ep:rounded-md ep:cursor-pointer ep:transition-opacity ep:disabled:opacity-50 ep:disabled:cursor-not-allowed ep:self-stretch"
					disabled={!isReady || isLoading}
					onClick={() => void submitQuery(query)}
				>
					{!isReady ? "Not configured" : isLoading ? "Analyzing..." : "Explore"}
				</button>
			</div>

			{/* Example queries */}
			<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2">
				<span class="ep:text-ui-smaller ep:text-obs-muted">
					Quick insights:
				</span>
				{EXAMPLE_QUERIES.map((ex) => (
					<button
						type="button"
						key={ex.text}
						class="ep:py-1 ep:px-3 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded-xl ep:bg-obs-primary ep:text-obs-muted ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:hover:text-obs-normal"
						onClick={() => {
							setQuery(ex.query);
							void submitQuery(ex.query);
						}}
					>
						{ex.text}
					</button>
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

// ─── TodaySection ───────────────────────────────────────────────────

interface Metric {
	label: string;
	value: string;
}

function TodaySection({
	statsCalculator,
	currentRange,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
}) {
	const [metrics, setMetrics] = useState<Metric[]>([]);
	const [summaryData, setSummaryData] = useState<{
		studied: number;
		dueTomorrow: number;
		dailyLoad: number;
	} | null>(null);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const summary = statsCalculator.getTodaySummary();
				const streak = statsCalculator.getStreakInfo();
				const rangeSummary =
					await statsCalculator.getRangeSummary(currentRange);

				if (cancelled) return;

				setMetrics([
					{ label: "Studied", value: summary.studied.toString() },
					{ label: "Minutes", value: summary.minutes.toString() },
					{ label: "New", value: summary.newCards.toString() },
					{ label: "Again", value: summary.again.toString() },
					{
						label: "Correct",
						value: `${Math.round(summary.correctRate * 100)}%`,
					},
					{ label: "Streak", value: `${streak.current}d` },
				]);
				setSummaryData({
					studied: summary.studied,
					dueTomorrow: rangeSummary.dueTomorrow,
					dailyLoad: rangeSummary.dailyLoad,
				});
				setHasError(false);
			} catch (err) {
				if (!cancelled) setHasError(true);
				console.error("Error refreshing today section:", err);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [statsCalculator, currentRange]);

	if (hasError) {
		return (
			<StatsCard>
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-32 ep:text-obs-error ep:text-ui-small">
					Failed to load today's statistics.
				</div>
			</StatsCard>
		);
	}

	return (
		<div class="ep:mb-5 ep:p-5 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border">
				<span class="ep:text-ui-large ep:font-semibold ep:text-obs-normal ep:tracking-tight">
					Today
				</span>
			</div>

			{/* Grid */}
			<div class="ep:grid ep:gap-3 ep:grid-cols-2 md:ep:grid-cols-3">
				{metrics.map((m) => (
					<div
						key={m.label}
						class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-4 ep:rounded-lg ep:bg-obs-primary ep:transition-all ep:duration-200 ep:hover:-translate-y-0.5 ep:cursor-pointer"
					>
						<span class="ep:text-3xl ep:font-semibold ep:text-obs-normal ep:mb-1 ep:font-interface">
							{m.value}
						</span>
						<span class="ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wider">
							{m.label}
						</span>
					</div>
				))}
			</div>

			{/* Summary */}
			{summaryData && (
				<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
					{summaryData.studied === 0 ? (
						<div class="ep:text-ui-small ep:text-obs-muted ep:italic ep:text-center">
							No cards have been studied today.
						</div>
					) : (
						<div class="ep:flex ep:flex-col ep:gap-1.5">
							<div class="ep:text-ui-small ep:text-obs-muted ep:flex ep:items-center ep:gap-2">
								<div class="ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-interactive ep:shrink-0" />
								<span>Due tomorrow: {summaryData.dueTomorrow} reviews</span>
							</div>
							<div class="ep:text-ui-small ep:text-obs-muted ep:flex ep:items-center ep:gap-2">
								<div class="ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-interactive ep:shrink-0" />
								<span>Daily load: ~{summaryData.dailyLoad} reviews/day</span>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── TimeRangeSelector ──────────────────────────────────────────────

const TIME_RANGES: { label: string; value: StatsTimeRange }[] = [
	{ label: "Backlog", value: "backlog" },
	{ label: "1 Month", value: "1m" },
	{ label: "3 Months", value: "3m" },
	{ label: "1 Year", value: "1y" },
	{ label: "All", value: "all" },
];

function TimeRangeSelector({
	currentRange,
	onRangeChange,
}: {
	currentRange: StatsTimeRange;
	onRangeChange: (range: StatsTimeRange) => void;
}) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:mb-5 ep:flex-wrap">
			{TIME_RANGES.map(({ label, value }) => {
				const isActive = value === currentRange;
				return (
					<button
						type="button"
						key={value}
						class={[
							"ep:py-2 ep:px-4 ep:rounded-lg ep:text-ui-small ep:font-medium ep:transition-all ep:duration-200 ep:cursor-pointer",
							isActive
								? "ep:bg-obs-interactive ep:text-obs-on-accent"
								: "ep:bg-obs-secondary ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:hover:-translate-y-px",
						].join(" ")}
						onClick={() => {
							if (value !== currentRange) onRangeChange(value);
						}}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}

// ─── FutureDueChart ─────────────────────────────────────────────────

function FutureDueChart({
	statsCalculator,
	currentRange,
	onCardPreview,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview: (date: string, cards: FSRSFlashcardItem[]) => void;
}) {
	const [data, setData] = useState<FutureDueEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		try {
			const result = statsCalculator.getFutureDueStatsFilled(currentRange);
			setData(result);
		} catch (err) {
			console.error("Error fetching future due data:", err);
			setData([]);
		} finally {
			setLoading(false);
		}
	}, [statsCalculator, currentRange]);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const total = data.reduce((sum, d) => sum + d.count, 0);
		const avg = Math.round(total / data.length);
		return [`Total: ${total} reviews`, `Average: ${avg} reviews/day`];
	}, [data]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);
			return new Chart(canvas, {
				type: "bar",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets: [
						{
							label: "Cards Due",
							data: data.map((d) => d.count),
							backgroundColor: getThemeColorWithAlpha("--color-blue", 0.7),
							borderColor: getThemeColor("--color-blue"),
							borderWidth: 1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								title: (items) => {
									if (items.length > 0)
										return formatDateForDisplay(
											data[items[0]?.dataIndex ?? 0]?.date ?? "",
										);
									return "";
								},
							},
						},
					},
					scales: {
						y: { beginAtZero: true, ticks: { precision: 0 } },
						x: {
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								maxTicksLimit: maxTicks,
							},
						},
					},
					onClick: (_event, elements) => {
						if (elements.length > 0) {
							const entry = data[elements[0]?.index ?? 0];
							if (entry && entry.count > 0) {
								const cards = statsCalculator.getCardsDueOnDate(entry.date);
								onCardPreview(entry.date, cards);
							}
						}
					},
				},
			});
		},
		[data, currentRange, statsCalculator, onCardPreview],
	);

	if (loading) return null;

	return (
		<ChartCard
			title="Future due"
			buildChart={buildChart}
			deps={[data, currentRange]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}

// ─── ReviewsChart ───────────────────────────────────────────────────

function ReviewsChart({
	statsCalculator,
	currentRange,
	onCardPreview,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview: (date: string, cards: FSRSFlashcardItem[]) => void;
}) {
	const [data, setData] = useState<CardsCreatedVsReviewedEntry[]>([]);
	const [visibility, setVisibility] = useState({
		created: false,
		reviewed: true,
		createdAndReviewedSameDay: false,
	});

	useEffect(() => {
		if (currentRange === "backlog") {
			setData([]);
			return;
		}
		try {
			const result =
				statsCalculator.getCardsCreatedVsReviewedHistory(currentRange);
			setData(result);
		} catch (err) {
			console.error("Error fetching reviews data:", err);
			setData([]);
		}
	}, [statsCalculator, currentRange]);

	const toggleVisibility = useCallback((key: keyof typeof visibility) => {
		setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
	}, []);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const totalReviewed = data.reduce((sum, d) => sum + d.reviewed, 0);
		const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
		const daysStudied = data.filter((d) => d.reviewed > 0).length;
		const totalDays = data.length;
		const percentStudied =
			totalDays > 0 ? ((daysStudied / totalDays) * 100).toFixed(1) : "0";
		const avgPerDay = totalDays > 0 ? Math.round(totalReviewed / totalDays) : 0;
		const avgPerStudyDay =
			daysStudied > 0 ? Math.round(totalReviewed / daysStudied) : 0;

		const items: string[] = [
			`Days studied: ${daysStudied} of ${totalDays} (${percentStudied}%)`,
			`Total: ${totalReviewed.toLocaleString()} reviews`,
			`Average over period: ${avgPerDay} reviews/day`,
		];

		if (daysStudied > 0 && daysStudied !== totalDays) {
			items.push(`Average for days studied: ${avgPerStudyDay} reviews/day`);
		}
		if (visibility.created) {
			items.push(`Total created: ${totalCreated.toLocaleString()} cards`);
		}
		return items;
	}, [data, visibility.created]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);
			const datasets: ChartDataset<"bar", number[]>[] = [];

			if (visibility.reviewed) {
				datasets.push({
					label: "Reviewed",
					data: data.map((d) => d.reviewed),
					backgroundColor: getThemeColorWithAlpha("--color-blue", 0.7),
					borderColor: getThemeColor("--color-blue"),
					borderWidth: 1,
				});
			}
			if (visibility.created) {
				datasets.push({
					label: "Created",
					data: data.map((d) => d.created),
					backgroundColor: getThemeColorWithAlpha("--color-green", 0.7),
					borderColor: getThemeColor("--color-green"),
					borderWidth: 1,
				});
			}
			if (visibility.createdAndReviewedSameDay) {
				datasets.push({
					label: "Same Day",
					data: data.map((d) => d.createdAndReviewedSameDay),
					backgroundColor: getThemeColorWithAlpha("--color-orange", 0.8),
					borderColor: getThemeColor("--color-orange"),
					borderWidth: 1,
				});
			}

			return new Chart(canvas, {
				type: "bar",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets,
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								title: (items) => {
									if (items.length > 0)
										return formatDateForDisplay(
											data[items[0]?.dataIndex ?? 0]?.date ?? "",
										);
									return "";
								},
							},
						},
					},
					scales: {
						y: { beginAtZero: true, ticks: { precision: 0 } },
						x: {
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								maxTicksLimit: maxTicks,
							},
						},
					},
					onClick: (_event, elements) => {
						if (elements.length > 0) {
							const entry = data[elements[0]?.index ?? 0];
							if (entry && (entry.created > 0 || entry.reviewed > 0)) {
								const cards = statsCalculator.getCardsDueOnDate(entry.date);
								onCardPreview(entry.date, cards);
							}
						}
					},
				},
			});
		},
		[data, currentRange, visibility, statsCalculator, onCardPreview],
	);

	const isBacklog = currentRange === "backlog";

	const controlDefs = useMemo(
		() => [
			{
				key: "reviewed" as const,
				label: "Reviewed",
				color: getThemeColorWithAlpha("--color-blue", 0.9),
			},
			{
				key: "created" as const,
				label: "Created",
				color: getThemeColorWithAlpha("--color-green", 0.9),
			},
			{
				key: "createdAndReviewedSameDay" as const,
				label: "Same Day",
				color: getThemeColorWithAlpha("--color-orange", 0.9),
			},
		],
		[],
	);

	if (isBacklog) {
		return (
			<StatsCard title="Reviews">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					Select a time range to see reviews
				</div>
			</StatsCard>
		);
	}

	const controls = (
		<div class="ep:flex ep:flex-wrap ep:gap-4 ep:justify-center ep:mb-3 ep:pb-3 ep:border-b ep:border-obs-border">
			{controlDefs.map(({ key, label, color }) => (
				<button
					type="button"
					key={key}
					class="ep:flex ep:items-center ep:gap-1.5 ep:cursor-pointer ep:select-none ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit"
					onClick={() => toggleVisibility(key)}
				>
					<input
						id={`reviews-toggle-${key}`}
						type="checkbox"
						class="ep:cursor-pointer ep-dynamic-accent"
						checked={visibility[key]}
						style={{ "--ep-dynamic-color": color } as Record<string, string>}
						onChange={() => toggleVisibility(key)}
					/>
					<label
						htmlFor={`reviews-toggle-${key}`}
						class="ep:text-ui-small ep:cursor-pointer ep-dynamic-color"
						style={
							{
								"--ep-dynamic-color": visibility[key]
									? color
									: "var(--text-muted)",
							} as Record<string, string>
						}
					>
						{label}
					</label>
				</button>
			))}
		</div>
	);

	return (
		<ChartCard
			title="Reviews"
			buildChart={buildChart}
			deps={[data, currentRange, visibility]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
			aboveCanvas={controls}
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}

// ─── RetentionChart ─────────────────────────────────────────────────

function RetentionChart({
	statsCalculator,
	currentRange,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
}) {
	const [data, setData] = useState<RetentionEntry[]>([]);

	useEffect(() => {
		try {
			const result = statsCalculator.getRetentionHistory(currentRange);
			setData(result);
		} catch (err) {
			console.error("Error fetching retention data:", err);
			setData([]);
		}
	}, [statsCalculator, currentRange]);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const avgRetention = Math.round(
			data.reduce((sum, d) => sum + d.retention, 0) / data.length,
		);
		const totalReviews = data.reduce((sum, d) => sum + d.total, 0);
		return [`Average: ${avgRetention}%`, `Total reviews: ${totalReviews}`];
	}, [data]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);
			return new Chart(canvas, {
				type: "line",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets: [
						{
							label: "Retention %",
							data: data.map((d) => d.retention),
							borderColor: getThemeColor("--color-green"),
							backgroundColor: getThemeColorWithAlpha("--color-green", 0.1),
							fill: true,
							tension: 0.3,
							pointRadius: data.length > 30 ? 0 : 3,
							pointHoverRadius: 5,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								title: (items) => {
									if (items.length > 0)
										return formatDateForDisplay(
											data[items[0]?.dataIndex ?? 0]?.date ?? "",
										);
									return "";
								},
								label: (context) => {
									const entry = data[context.dataIndex];
									return entry
										? `${entry.retention}% (${entry.total} reviews)`
										: "";
								},
							},
						},
					},
					scales: {
						y: {
							min: 0,
							max: 100,
							ticks: { callback: (value) => `${value}%` },
						},
						x: {
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								maxTicksLimit: maxTicks,
							},
						},
					},
				},
			});
		},
		[data, currentRange],
	);

	return (
		<ChartCard
			title="Retention rate"
			buildChart={buildChart}
			deps={[data, currentRange]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}

// ─── CardCountsChart ────────────────────────────────────────────────

function CardCountsChart({
	statsCalculator,
	onCategoryClick,
}: {
	statsCalculator: StatsCalculatorService;
	onCategoryClick: (
		category: keyof CardMaturityBreakdown,
		label: string,
		cards: FSRSFlashcardItem[],
	) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart | null>(null);
	const [breakdown, setBreakdown] = useState<CardMaturityBreakdown | null>(
		null,
	);
	const [total, setTotal] = useState(0);

	useEffect(() => {
		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		try {
			const bd = statsCalculator.getCardMaturityBreakdown();
			const activeTotal = bd.new + bd.learning + bd.young + bd.mature;
			const t = activeTotal + bd.suspended + bd.buried;
			setBreakdown(bd);
			setTotal(t);
		} catch (err) {
			console.error("Error refreshing card counts chart:", err);
			setBreakdown(null);
		}
	}, [statsCalculator]);

	// Build chart when data changes
	useEffect(() => {
		if (!breakdown || total === 0 || !canvasRef.current) return;

		chartRef.current?.destroy();

		const colors = {
			new: getThemeColor("--color-green"),
			learning: getThemeColor("--color-orange"),
			young: getThemeColor("--color-blue"),
			mature: getThemeColor("--color-purple"),
			suspended: getThemeColor("--text-faint"),
			buried: getThemeColor("--text-muted"),
		};

		const chartData: number[] = [
			breakdown.new,
			breakdown.learning,
			breakdown.young,
			breakdown.mature,
		];
		const chartLabels: string[] = ["New", "Learning", "Young", "Mature"];
		const chartColors: string[] = [
			colors.new,
			colors.learning,
			colors.young,
			colors.mature,
		];

		if (breakdown.suspended > 0) {
			chartData.push(breakdown.suspended);
			chartLabels.push("Suspended");
			chartColors.push(colors.suspended);
		}
		if (breakdown.buried > 0) {
			chartData.push(breakdown.buried);
			chartLabels.push("Buried");
			chartColors.push(colors.buried);
		}

		chartRef.current = new Chart(canvasRef.current, {
			type: "doughnut",
			data: {
				labels: chartLabels,
				datasets: [{ data: chartData, backgroundColor: chartColors }],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
			},
		});
	}, [breakdown, total]);

	if (!breakdown || total === 0) {
		return (
			<StatsCard title="Card counts">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					No cards found
				</div>
			</StatsCard>
		);
	}

	const colors = {
		new: getThemeColor("--color-green"),
		learning: getThemeColor("--color-orange"),
		young: getThemeColor("--color-blue"),
		mature: getThemeColor("--color-purple"),
		suspended: getThemeColor("--text-faint"),
		buried: getThemeColor("--text-muted"),
	};

	const legendItems: {
		label: string;
		value: number;
		color: string;
		category: keyof CardMaturityBreakdown;
	}[] = [
		{ label: "New", value: breakdown.new, color: colors.new, category: "new" },
		{
			label: "Learning",
			value: breakdown.learning,
			color: colors.learning,
			category: "learning",
		},
		{
			label: "Young",
			value: breakdown.young,
			color: colors.young,
			category: "young",
		},
		{
			label: "Mature",
			value: breakdown.mature,
			color: colors.mature,
			category: "mature",
		},
	];

	if (breakdown.suspended > 0) {
		legendItems.push({
			label: "Suspended",
			value: breakdown.suspended,
			color: colors.suspended,
			category: "suspended",
		});
	}
	if (breakdown.buried > 0) {
		legendItems.push({
			label: "Buried",
			value: breakdown.buried,
			color: colors.buried,
			category: "buried",
		});
	}

	return (
		<StatsCard title="Card counts">
			<div class="ep:flex ep:gap-8 ep:items-center ep:justify-center">
				{/* Chart */}
				<div class="ep:w-45 ep:h-45 ep:relative ep:shrink-0">
					<canvas
						ref={canvasRef}
						class="ep:w-full! ep:h-full! true-recall-chart-fade-in"
					/>
				</div>

				{/* Legend */}
				<div class="ep:flex ep:flex-col ep:gap-2">
					{legendItems.map((item) => {
						const percentage = Math.round((item.value / total) * 100);
						return (
							<button
								type="button"
								key={item.category}
								class="ep:flex ep:items-center ep:gap-3 ep:py-2 ep:px-3 ep:rounded-md ep:transition-all ep:cursor-pointer ep:hover:bg-obs-primary ep:hover:-translate-x-0.5 ep:bg-transparent ep:border-none ep:font-inherit ep:text-left ep:w-full"
								onClick={() => {
									if (item.value > 0) {
										const cards = statsCalculator.getCardsByCategory(
											item.category,
										);
										onCategoryClick(item.category, item.label, cards);
									}
								}}
							>
								<div
									class="ep:w-4 ep:h-4 ep:rounded-sm ep:shrink-0 ep-dynamic-bg"
									style={
										{ "--ep-dynamic-color": item.color } as Record<
											string,
											string
										>
									}
								/>
								<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
									{item.label}
								</span>
								<span class="ep:ml-auto ep:text-ui-small ep:font-semibold ep:text-obs-muted">
									{item.value} ({percentage}%)
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</StatsCard>
	);
}

// ─── CalendarHeatmap ────────────────────────────────────────────────

function getHeatmapLevelClasses(count: number): string {
	if (count === 0) return "ep:!bg-obs-modifier-border";
	if (count < 10) return "ep:!bg-[rgba(var(--obs-green-rgb),0.2)]";
	if (count < 25) return "ep:!bg-[rgba(var(--obs-green-rgb),0.4)]";
	if (count < 50) return "ep:!bg-[rgba(var(--obs-green-rgb),0.6)]";
	return "ep:!bg-[rgba(var(--obs-green-rgb),0.9)]";
}

function CalendarHeatmap({
	statsCalculator,
	onCardPreview,
}: {
	statsCalculator: StatsCalculatorService;
	onCardPreview: (date: string, cards: FSRSFlashcardItem[]) => void;
}) {
	const [allStats, setAllStats] = useState<
		Record<string, { reviewsCompleted: number }>
	>({});

	useEffect(() => {
		try {
			const stats = statsCalculator.getAllDailyStats();
			setAllStats(stats);
		} catch (err) {
			console.error("Error refreshing calendar heatmap:", err);
			setAllStats({});
		}
	}, [statsCalculator]);

	const today = useMemo(() => new Date(), []);
	const startDate = useMemo(() => {
		const d = new Date(today);
		d.setDate(d.getDate() - 364);
		d.setDate(d.getDate() - d.getDay()); // Align to Sunday
		return d;
	}, [today]);

	// Build grid data
	const weeks = useMemo(() => {
		const result: Array<
			Array<{
				dateKey: string;
				count: number;
				isFuture: boolean;
			}>
		> = [];
		for (let week = 0; week < 53; week++) {
			const days: (typeof result)[0] = [];
			for (let day = 0; day < 7; day++) {
				const cellDate = new Date(startDate);
				cellDate.setDate(cellDate.getDate() + week * 7 + day);
				const dateKey = cellDate.toISOString().split("T")[0] ?? "";
				const stats = allStats[dateKey];
				days.push({
					dateKey,
					count: stats?.reviewsCompleted ?? 0,
					isFuture: cellDate > today,
				});
			}
			result.push(days);
		}
		return result;
	}, [allStats, startDate, today]);

	return (
		<StatsCard title="Activity calendar">
			{/* Year header */}
			<div class="ep:text-center ep:text-ui-small ep:font-semibold ep:mb-3 ep:text-obs-normal">
				{today.getFullYear()}
			</div>

			{/* Calendar grid */}
			<div class="ep:flex ep:gap-0.5 ep:flex-nowrap ep:overflow-x-auto ep:pb-2 true-recall-scrollbar-thin">
				{weeks.map((week, wi) => (
					<div key={wi} class="ep:flex ep:flex-col ep:gap-0.5">
						{week.map((cell) => (
							<button
								type="button"
								key={cell.dateKey}
								class={[
									"ep:w-3 ep:h-3 ep:rounded-sm ep:cursor-pointer ep:transition-all ep:duration-200 ep:hover:scale-110 ep:hover:opacity-80 ep:border-none ep:p-0",
									getHeatmapLevelClasses(cell.count),
									cell.isFuture ? "ep:opacity-30" : "",
								].join(" ")}
								title={`${cell.dateKey}: ${cell.count} reviews`}
								aria-label={`${cell.dateKey}: ${cell.count} reviews`}
								onClick={() => {
									if (cell.count > 0) {
										const cards = statsCalculator.getCardsDueOnDate(
											cell.dateKey,
										);
										onCardPreview(cell.dateKey, cards);
									}
								}}
							/>
						))}
					</div>
				))}
			</div>

			{/* Legend */}
			<div class="ep:flex ep:items-center ep:justify-end ep:gap-1 ep:mt-3 ep:text-ui-smaller ep:text-obs-muted">
				<span>Less</span>
				{[0, 1, 10, 25, 50].map((count) => (
					<div
						key={count}
						class={[
							"ep:w-3 ep:h-3 ep:rounded-sm ep:cursor-default",
							getHeatmapLevelClasses(count),
						].join(" ")}
					/>
				))}
				<span>More</span>
			</div>
		</StatsCard>
	);
}

// ─── StatsApp (root) ────────────────────────────────────────────────

export function StatsApp() {
	const plugin = usePlugin();

	const statsCalculator = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	const currentRange = useSignal<StatsTimeRange>("1m");

	// Refresh tick: bumped by signals, forces re-render of children
	const [refreshTick, setRefreshTick] = useState(0);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		const disposer = effect(() => {
			track(dataVersion, settingsVersion, syncVersion);
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				setRefreshTick((t) => t + 1);
				timer = null;
			}, 500);
		});
		return () => {
			disposer();
			if (timer) clearTimeout(timer);
		};
	}, []);

	const handleCardPreviewForDate = useCallback(
		(date: string, cards: FSRSFlashcardItem[]) => {
			new CardPreviewModal(plugin.app, {
				title: `Cards reviewed: ${formatDateForDisplay(date)}`,
				cards,
				flashcardManager: plugin.flashcardManager,
			}).open();
		},
		[plugin],
	);

	const handleCardPreviewForCategory = useCallback(
		(
			category: keyof CardMaturityBreakdown,
			label: string,
			cards: FSRSFlashcardItem[],
		) => {
			new CardPreviewModal(plugin.app, {
				title: `${label} cards (${cards.length})`,
				cards,
				flashcardManager: plugin.flashcardManager,
				category,
			}).open();
		},
		[plugin],
	);

	// The refreshTick is used as a key suffix to force remounting of data-fetching components
	// when signals fire, replicating the old imperative refresh() behavior.
	const dataKey = refreshTick;

	return (
		<div class="ep:p-2 ep:max-w-[900px] ep:mx-auto">
			<NLQueryPanel nlQueryService={plugin.nlQueryService} />

			<TodaySection
				key={`today-${dataKey}`}
				statsCalculator={statsCalculator}
				currentRange={currentRange.value}
			/>

			<TimeRangeSelector
				currentRange={currentRange.value}
				onRangeChange={(range) => {
					currentRange.value = range;
				}}
			/>

			<FutureDueChart
				key={`future-${dataKey}`}
				statsCalculator={statsCalculator}
				currentRange={currentRange.value}
				onCardPreview={handleCardPreviewForDate}
			/>

			<ReviewsChart
				key={`reviews-${dataKey}`}
				statsCalculator={statsCalculator}
				currentRange={currentRange.value}
				onCardPreview={handleCardPreviewForDate}
			/>

			<RetentionChart
				key={`retention-${dataKey}`}
				statsCalculator={statsCalculator}
				currentRange={currentRange.value}
			/>

			<CardCountsChart
				key={`counts-${dataKey}`}
				statsCalculator={statsCalculator}
				onCategoryClick={handleCardPreviewForCategory}
			/>

			<CalendarHeatmap
				key={`heatmap-${dataKey}`}
				statsCalculator={statsCalculator}
				onCardPreview={handleCardPreviewForDate}
			/>
		</div>
	);
}
