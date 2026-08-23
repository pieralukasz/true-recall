import type {
	LocalAnswerAssessment,
	SemanticGradingResult,
	SuggestedRating,
	TypeInVerdict,
} from "@true-recall/core/types";

import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

interface TypeInAssessmentPanelProps {
	isChecking: boolean;
	result: SemanticGradingResult | null;
	message: string | null;
	fallback: LocalAnswerAssessment | null;
}

const VERDICT_CONFIG: Record<
	TypeInVerdict,
	{ label: string; icon: string; accent: string; text: string; badge: string }
> = {
	correct: {
		label: "Correct",
		icon: "check-circle-2",
		accent: "ep:border-l-obs-green",
		text: "ep:text-obs-green",
		badge: "ep:bg-obs-green/12 ep:text-obs-green",
	},
	partial: {
		label: "Partially correct",
		icon: "circle-dot",
		accent: "ep:border-l-obs-orange",
		text: "ep:text-obs-orange",
		badge: "ep:bg-obs-orange/12 ep:text-obs-orange",
	},
	wrong: {
		label: "Not quite",
		icon: "x-circle",
		accent: "ep:border-l-obs-red",
		text: "ep:text-obs-red",
		badge: "ep:bg-obs-red/12 ep:text-obs-red",
	},
};

const RATING_LABELS: Record<SuggestedRating, string> = {
	again: "Again",
	hard: "Hard",
	good: "Good",
	easy: "Easy",
};

const PANEL_BASE =
	"true-recall-type-in-assessment ep:mt-6 ep:rounded-xl ep:border ep:border-obs-border ep:bg-obs-secondary/25 ep:overflow-hidden";

function ChecklistIcon({ icon, cls }: { icon: string; cls: string }) {
	const iconRef = useIcon(icon);
	return (
		<span
			ref={iconRef}
			class={cn("ep:shrink-0 ep:mt-0.5 ep:[&>svg]:w-3.5 ep:[&>svg]:h-3.5", cls)}
		/>
	);
}

function ChecklistSection({
	title,
	items,
	icon,
	iconCls,
}: {
	title: string;
	items: string[];
	icon: string;
	iconCls: string;
}) {
	if (items.length === 0) return null;
	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5">
			<span class="ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wide">
				{title}
			</span>
			{items.map((item) => (
				<div
					key={item}
					class="ep:flex ep:items-start ep:gap-2 ep:text-ui-small ep:text-obs-normal"
				>
					<ChecklistIcon icon={icon} cls={iconCls} />
					<span class="ep:leading-snug">{item}</span>
				</div>
			))}
		</div>
	);
}

function CheckingState() {
	return (
		<div class={cn(PANEL_BASE, "ep:p-4 ep:flex ep:items-center ep:gap-3")}>
			<span class="ep:w-2 ep:h-2 ep:rounded-full ep:bg-obs-interactive ep:animate-pulse" />
			<span class="ep:text-ui-small ep:text-obs-muted">
				Checking your answer…
			</span>
		</div>
	);
}

function VerdictHeader({ result }: { result: SemanticGradingResult }) {
	const config = VERDICT_CONFIG[result.verdict];
	const verdictIconRef = useIcon(config.icon);
	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:gap-2 ep:flex-wrap">
			<div class={cn("ep:flex ep:items-center ep:gap-2", config.text)}>
				<span ref={verdictIconRef} class="ep:[&>svg]:w-5 ep:[&>svg]:h-5" />
				<span class="ep:text-ui-medium ep:font-semibold">{config.label}</span>
			</div>
			<span
				class={cn(
					"ep:text-ui-smaller ep:font-medium ep:px-2 ep:py-1 ep:rounded-md",
					config.badge,
				)}
			>
				Suggested: {RATING_LABELS[result.suggestedRating]} · Enter
			</span>
		</div>
	);
}

function VerdictState({ result }: { result: SemanticGradingResult }) {
	const config = VERDICT_CONFIG[result.verdict];
	return (
		<div class={cn(PANEL_BASE, "ep:border-l-2", config.accent)}>
			<div class="ep:p-4 ep:flex ep:flex-col ep:gap-3">
				<VerdictHeader result={result} />
				{result.teacherComment && (
					<p class="ep:m-0 ep:text-ui-small ep:text-obs-normal ep:leading-relaxed">
						{result.teacherComment}
					</p>
				)}
				{(result.covered.length > 0 ||
					result.missing.length > 0 ||
					result.errors.length > 0) && (
					<div class="ep:flex ep:flex-col ep:gap-3 ep:pt-1 ep:border-t ep:border-obs-border/60">
						<ChecklistSection
							title="You covered"
							items={result.covered}
							icon="check"
							iconCls="ep:text-obs-green"
						/>
						<ChecklistSection
							title="Missing"
							items={result.missing}
							icon="circle-dashed"
							iconCls="ep:text-obs-orange"
						/>
						<ChecklistSection
							title="Incorrect"
							items={result.errors}
							icon="x"
							iconCls="ep:text-obs-red"
						/>
					</div>
				)}
			</div>
		</div>
	);
}

function TokenRow({
	label,
	tokens,
	variant,
}: {
	label: string;
	tokens: Array<{ text: string; type: "match" | "missing" | "extra" }>;
	variant: "expected" | "user";
}) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<span class="ep:text-ui-smaller ep:text-obs-muted">{label}</span>
			<div class="ep:flex ep:flex-wrap ep:gap-1.5">
				{tokens.length === 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-faint">·</span>
				)}
				{tokens.map((token, index) => {
					const isMatch = token.type === "match";
					const isError =
						variant === "expected"
							? token.type === "missing"
							: token.type === "extra";
					return (
						<span
							key={`${token.type}-${token.text}-${index}`}
							class={cn(
								"ep:px-1.5 ep:py-0.5 ep:rounded-sm ep:text-ui-smaller",
								isMatch && "ep:bg-obs-green/20 ep:text-obs-green",
								isError && "ep:bg-obs-red/20 ep:text-obs-red",
								!isMatch && !isError && "ep:text-obs-faint",
							)}
						>
							{token.text}
						</span>
					);
				})}
			</div>
		</div>
	);
}

function FallbackState({
	message,
	fallback,
}: {
	message: string;
	fallback: LocalAnswerAssessment | null;
}) {
	const expectedTokens =
		fallback?.diff.filter((token) => token.type !== "extra") ?? [];
	const userTokens =
		fallback?.diff.filter((token) => token.type !== "missing") ?? [];
	return (
		<div class={cn(PANEL_BASE, "ep:p-4 ep:flex ep:flex-col ep:gap-3")}>
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
				<span class="ep:text-ui-small ep:font-medium">
					Text comparison (fallback)
				</span>
				{fallback && (
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						{fallback.score}% match
					</span>
				)}
			</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">{message}</div>
			{fallback && (
				<>
					<TokenRow
						label="Expected answer"
						tokens={expectedTokens}
						variant="expected"
					/>
					<TokenRow label="Your answer" tokens={userTokens} variant="user" />
				</>
			)}
		</div>
	);
}

export function TypeInAssessmentPanel({
	isChecking,
	result,
	message,
	fallback,
}: TypeInAssessmentPanelProps) {
	if (isChecking) return <CheckingState />;
	if (result) return <VerdictState result={result} />;
	if (message) return <FallbackState message={message} fallback={fallback} />;
	return null;
}
