import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { Platform } from "obsidian";
import { Rating, type Grade } from "ts-fsrs";
import { useApp, usePlugin } from "../preact/ObsidianContext";
import { useMarkdown } from "../preact/hooks";
import { stripBrTags } from "../../utils";
import {
	toggleTextareaWrap,
	insertAtTextareaCursor,
	setupAutoResize,
	TOOLBAR_BUTTONS,
	type ToolbarButton,
	type ToolbarButtonAction,
} from "../editor/edit-toolbar.utils";
import { UI_CONFIG } from "../../constants";
import type { ReviewApi, SessionPhase, BadgeCounts, EditModeState } from "../../state/store";
import type { FSRSFlashcardItem, ReviewSessionStats, SchedulingPreview } from "../../types";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ReviewAppProps {
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onStartEdit: (field: "question" | "answer") => void;
	onSaveEdit: (textarea: HTMLTextAreaElement, field: "question" | "answer") => void;
	onImagePaste: (file: File, textarea: HTMLTextAreaElement) => void;
	onOpenSourceNote: () => void;
	onClose: () => void;
	onNextSession: () => void;
	onEndSession: () => void;
	onActionsMenu: (e: MouseEvent) => void;
	isCustomSession: boolean;
	crammingMode: boolean;
	showHeader: boolean;
	showHeaderStats: boolean;
	showNextReviewTime: boolean;
	continuousCustomReviews: boolean;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export function ReviewApp(props: ReviewAppProps) {
	const plugin = usePlugin();
	const review = plugin.store!.getState().review;

	const [, setTick] = useState(0);
	useEffect(() => {
		return plugin.store!.subscribe(
			(state) => state.review,
			() => setTick((t) => t + 1),
		);
	}, [plugin]);

	const phase = review.getPhase();

	switch (phase.type) {
		case "idle":
			return null;
		case "complete":
			return (
				<SummaryScreen
					review={review}
					isCustomSession={props.isCustomSession}
					continuousCustomReviews={props.continuousCustomReviews}
					onClose={props.onClose}
					onNextSession={props.onNextSession}
				/>
			);
		case "waiting":
			return (
				<WaitingScreen
					review={review}
					timeUntilDue={phase.timeUntilDue}
					onEndSession={props.onEndSession}
				/>
			);
		case "active":
			return (
				<ActiveReview
					card={phase.card}
					review={review}
					{...props}
				/>
			);
	}
}

// ─── Active Review Screen ────────────────────────────────────────────────────

interface ActiveReviewProps extends ReviewAppProps {
	card: FSRSFlashcardItem;
	review: ReviewApi;
}

function ActiveReview({
	card,
	review,
	onShowAnswer,
	onAnswer,
	onStartEdit,
	onSaveEdit,
	onImagePaste,
	onOpenSourceNote,
	onClose,
	onActionsMenu,
	crammingMode,
	showHeader,
	showHeaderStats,
	showNextReviewTime,
}: ActiveReviewProps) {
	const editState = review.getEditState();
	const isAnswerRevealed = review.isAnswerRevealed;
	const isEditing = editState.active;

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			{showHeader && (
				<Header
					review={review}
					showStats={showHeaderStats}
					crammingMode={crammingMode}
				/>
			)}

			<CardContainer
				card={card}
				editState={editState}
				isAnswerRevealed={isAnswerRevealed}
				onStartEdit={onStartEdit}
				onSaveEdit={onSaveEdit}
				onImagePaste={onImagePaste}
				onOpenSourceNote={onOpenSourceNote}
			/>

			{!isEditing && (
				<ButtonBar
					isAnswerRevealed={isAnswerRevealed}
					preview={review.getSchedulingPreview()}
					showNextReviewTime={showNextReviewTime}
					onShowAnswer={onShowAnswer}
					onAnswer={onAnswer}
					onActionsMenu={onActionsMenu}
				/>
			)}
		</div>
	);
}

// ─── Header Badges ───────────────────────────────────────────────────────────

function Header({
	review,
	showStats,
	crammingMode,
}: {
	review: ReviewApi;
	showStats: boolean;
	crammingMode: boolean;
}) {
	if (!showStats) return null;

	const counts = review.getBadgeCounts();

	return (
		<div class="ep:flex ep:justify-center ep:items-center ep:border-b ep:border-obs-border ep:relative ep:shrink-0 ep:p-2 ep:pb-4">
			<div class="ep:flex ep:items-center ep:gap-1.5">
				<StatBadge type="new" count={counts.new} />
				<StatBadge type="learning" count={counts.learning} />
				<StatBadge type="due" count={counts.due} />
				{crammingMode && (
					<div class="ep:flex ep:items-center ep:justify-center ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ep:bg-obs-orange/20 ep:text-obs-orange ep:ml-1">
						Cram
					</div>
				)}
			</div>
		</div>
	);
}

const BADGE_COLORS: Record<string, string> = {
	new: "ep:bg-obs-green/20 ep:text-obs-green",
	learning: "ep:bg-obs-orange/20 ep:text-obs-orange",
	due: "ep:bg-obs-blue/20 ep:text-obs-blue",
};

function StatBadge({ type, count }: { type: string; count: number }) {
	return (
		<div class={`ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ${BADGE_COLORS[type]}`}>
			<span>{count}</span>
		</div>
	);
}

// ─── Card Container ──────────────────────────────────────────────────────────

interface CardContainerProps {
	card: FSRSFlashcardItem;
	editState: EditModeState;
	isAnswerRevealed: boolean;
	onStartEdit: (field: "question" | "answer") => void;
	onSaveEdit: (textarea: HTMLTextAreaElement, field: "question" | "answer") => void;
	onImagePaste: (file: File, textarea: HTMLTextAreaElement) => void;
	onOpenSourceNote: () => void;
}

function CardContainer({
	card,
	editState,
	isAnswerRevealed,
	onStartEdit,
	onSaveEdit,
	onImagePaste,
	onOpenSourceNote,
}: CardContainerProps) {
	const isEditing = editState.active;
	const isEditingQuestion = isEditing && editState.field === "question";
	const isEditingAnswer = isEditing && editState.field === "answer";
	const sourcePath = card.sourceNotePath || "";

	const containerCls = `true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto${isEditing ? " true-recall-review-card-container--editing" : ""}`;

	// Handle clicks on internal links and edit triggers
	const handleContainerClick = useCallback((e: MouseEvent) => {
		const target = e.target as HTMLElement;

		// Handle field clicks for internal links + edit mode
		const fieldEl = target.closest<HTMLElement>("[data-field]");
		if (fieldEl) {
			const field = fieldEl.dataset.field as "question" | "answer" | undefined;
			if (field) {
				const linkEl = target.closest("a.internal-link");
				if (linkEl) {
					e.preventDefault();
					e.stopPropagation();
					if (e.metaKey || e.ctrlKey) {
						onStartEdit(field);
					}
					// Normal link click is handled by Obsidian's MarkdownRenderer
					return;
				}
				if (e.metaKey || e.ctrlKey) {
					onStartEdit(field);
				}
			}
		}
	}, [onStartEdit]);

	return (
		<div class={containerCls} onClick={handleContainerClick}>
			<div class="ep:w-full ep:text-center">
				{/* Card type label */}
				{card.cardType === "cloze" && card.clozeIndex !== undefined && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						{isEditingQuestion ? "Editing cloze template (all cards will update)" : `Cloze ${card.clozeIndex}`}
					</div>
				)}
				{card.cardType === "reversed" && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						Reversed
					</div>
				)}

				{/* Question */}
				{isEditingQuestion ? (
					<EditableField
						content={card.cardType === "cloze" && card.clozeTemplate ? card.clozeTemplate : card.question}
						field="question"
						sourcePath={sourcePath}
						isAnswerRevealed={isAnswerRevealed}
						onSave={onSaveEdit}
						onStartEdit={onStartEdit}
						onImagePaste={onImagePaste}
					/>
				) : (
					<MarkdownField
						content={stripBrTags(card.question)}
						sourcePath={sourcePath}
						field="question"
						cls="true-recall-review-question ep:text-xl ep:leading-relaxed ep:text-obs-normal ep:mb-6"
						onLongPress={() => onStartEdit("question")}
					/>
				)}

				{/* Answer (if revealed and not editing question) */}
				{isAnswerRevealed && !isEditingQuestion && (
					<>
						<div class="ep:border-t ep:border-obs-border ep:my-6" />
						{isEditingAnswer ? (
							<EditableField
								content={card.answer}
								field="answer"
								sourcePath={sourcePath}
								isAnswerRevealed={isAnswerRevealed}
								onSave={onSaveEdit}
								onStartEdit={onStartEdit}
								onImagePaste={onImagePaste}
							/>
						) : (
							<MarkdownField
								content={stripBrTags(card.answer)}
								sourcePath={sourcePath}
								field="answer"
								cls="true-recall-review-answer ep:text-lg ep:leading-relaxed ep:text-obs-muted"
								onLongPress={() => onStartEdit("answer")}
							/>
						)}
					</>
				)}

				{/* Backlink + Projects (visible when answer revealed and not editing) */}
				{isAnswerRevealed && !isEditing && (
					<>
						{card.sourceNoteName && (
							<div class="ep:mt-6 ep:text-center">
								<a
									class="ep:text-obs-accent ep:text-ui-small ep:cursor-pointer ep:no-underline ep:hover:underline ep:transition-colors"
									onClick={onOpenSourceNote}
								>
									{card.sourceNoteName}
								</a>
							</div>
						)}
						{card.projects && card.projects.length > 0 && (
							<ProjectBadges projects={card.projects} cardId={card.id} />
						)}
					</>
				)}
			</div>
		</div>
	);
}

// ─── Markdown Field ──────────────────────────────────────────────────────────

function MarkdownField({
	content,
	sourcePath,
	field,
	cls,
	onLongPress,
}: {
	content: string;
	sourcePath: string;
	field: string;
	cls: string;
	onLongPress: () => void;
}) {
	const ref = useMarkdown(content, sourcePath);
	const timerRef = useRef<number | null>(null);

	// Mobile long-press to edit
	const handleTouchStart = useCallback(() => {
		timerRef.current = window.setTimeout(onLongPress, UI_CONFIG.longPressDuration);
	}, [onLongPress]);

	const cancelTouch = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const touchHandlers = Platform.isMobile
		? { onTouchStart: handleTouchStart, onTouchEnd: cancelTouch, onTouchMove: cancelTouch }
		: {};

	return (
		<div
			ref={ref}
			class={cls}
			data-field={field}
			data-source-path={sourcePath}
			{...touchHandlers}
		/>
	);
}

// ─── Editable Field ──────────────────────────────────────────────────────────

interface EditableFieldProps {
	content: string;
	field: "question" | "answer";
	sourcePath: string;
	isAnswerRevealed: boolean;
	onSave: (textarea: HTMLTextAreaElement, field: "question" | "answer") => void;
	onStartEdit: (field: "question" | "answer") => void;
	onImagePaste: (file: File, textarea: HTMLTextAreaElement) => void;
}

function EditableField({
	content,
	field,
	sourcePath,
	isAnswerRevealed,
	onSave,
	onStartEdit,
	onImagePaste,
}: EditableFieldProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const cleanupRef = useRef<(() => void) | null>(null);

	// Auto-focus + auto-resize on mount
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		cleanupRef.current = setupAutoResize(textarea);

		setTimeout(() => {
			textarea.focus();
			const len = textarea.value.length;
			textarea.setSelectionRange(len, len);
			textarea.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 10);

		return () => cleanupRef.current?.();
	}, []);

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			if (textareaRef.current) onSave(textareaRef.current, field);
		} else if (e.key === "Tab") {
			e.preventDefault();
			const textarea = textareaRef.current;
			if (!textarea) return;
			const nextField = field === "question" ? "answer" : "question";
			if (nextField === "answer" && !isAnswerRevealed) return;
			onSave(textarea, field);
			onStartEdit(nextField);
		}
	}, [field, isAnswerRevealed, onSave, onStartEdit]);

	const handleBlur = useCallback((e: FocusEvent) => {
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (relatedTarget?.closest(".true-recall-edit-toolbar")) return;
		if (textareaRef.current) onSave(textareaRef.current, field);
	}, [field, onSave]);

	const handlePaste = useCallback((e: ClipboardEvent) => {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of Array.from(items)) {
			if (item.type.startsWith("image/")) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file && textareaRef.current) {
					onImagePaste(file, textareaRef.current);
				}
				return;
			}
		}
	}, [onImagePaste]);

	const executeAction = useCallback((action: ToolbarButtonAction) => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		switch (action.type) {
			case "toggle":
				toggleTextareaWrap(textarea, action.before, action.after);
				break;
			case "insert":
				insertAtTextareaCursor(textarea, action.text);
				break;
			case "custom":
				action.handler(textarea);
				break;
		}
		textarea.focus();
	}, []);

	const fieldCls = field === "question"
		? "true-recall-review-question ep:text-xl ep:leading-relaxed ep:text-obs-normal ep:mb-6 ep:relative"
		: "true-recall-review-answer ep:text-lg ep:leading-relaxed ep:text-obs-muted ep:relative";

	return (
		<div class={fieldCls} data-field={field} data-source-path={sourcePath}>
			<div class="ep:w-full ep:relative">
				<textarea
					ref={textareaRef}
					class="ep:w-full ep:text-center ep:text-obs-normal ep:resize-none ep-textarea-invisible"
					value={stripBrTags(content)}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					onPaste={handlePaste}
				/>
				<EditToolbar buttons={TOOLBAR_BUTTONS.UNIFIED} onAction={executeAction} />
			</div>
		</div>
	);
}

// ─── Edit Toolbar ────────────────────────────────────────────────────────────

function EditToolbar({
	buttons,
	onAction,
}: {
	buttons: ToolbarButton[];
	onAction: (action: ToolbarButtonAction) => void;
}) {
	return (
		<div class="true-recall-edit-toolbar ep:flex ep:flex-wrap ep:justify-center ep:gap-1 ep:py-2 ep:border-t ep:border-obs-border ep:absolute ep:left-0 ep:right-0 ep:top-full ep:mt-1 ep:z-10">
			{buttons.map((btn) => {
				const title = btn.shortcut ? `${btn.title} (${btn.shortcut})` : btn.title;
				return (
					<button
						key={btn.id}
						class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:transition-colors"
						title={title}
						tabIndex={-1}
						onMouseDown={(e: MouseEvent) => e.preventDefault()}
						onClick={(e: MouseEvent) => {
							e.preventDefault();
							onAction(btn.action);
						}}
					>
						{btn.label}
					</button>
				);
			})}
		</div>
	);
}

// ─── Project Badges ──────────────────────────────────────────────────────────

function ProjectBadges({ projects, cardId }: { projects: string[]; cardId: string }) {
	const [expanded, setExpanded] = useState(false);

	if (!expanded) {
		return (
			<div class="ep:mt-6 ep:flex ep:flex-col ep:items-center">
				<button
					class="ep:text-ui-small ep:text-obs-muted ep:cursor-pointer ep:hover:text-obs-normal ep:hover:underline ep:transition-colors ep:bg-transparent ep:border-none ep:p-0"
					onClick={() => setExpanded(true)}
				>
					Show projects ({projects.length})
				</button>
			</div>
		);
	}

	return (
		<div class="ep:mt-6 ep:flex ep:flex-col ep:items-center">
			<div class="ep:flex ep:flex-wrap ep:justify-center ep:gap-2">
				{projects.map((project) => (
					<span
						key={project}
						class="ep:text-obs-accent ep:text-ui-smaller ep:cursor-pointer ep:no-underline ep:hover:underline ep:transition-colors"
					>
						{project}
					</span>
				))}
			</div>
		</div>
	);
}

// ─── Button Bar ──────────────────────────────────────────────────────────────

const BASE_BTN_CLS =
	"ep:flex ep:flex-col ep:items-center ep:gap-1 !ep:py-4 ep:px-6 ep:h-auto ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

interface ButtonBarProps {
	isAnswerRevealed: boolean;
	preview: SchedulingPreview | null;
	showNextReviewTime: boolean;
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onActionsMenu: (e: MouseEvent) => void;
}

function ButtonBar({
	isAnswerRevealed,
	preview,
	showNextReviewTime,
	onShowAnswer,
	onAnswer,
	onActionsMenu,
}: ButtonBarProps) {
	const menuIconRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (menuIconRef.current) {
			const { setIcon } = require("obsidian");
			setIcon(menuIconRef.current, "more-vertical");
		}
	}, []);

	return (
		<div class="true-recall-review-buttons ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4">
			<div class="ep:flex ep:items-center ep:justify-center ep:w-full ep:relative">
				<div class="ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap ep:py-4">
					{!isAnswerRevealed ? (
						<button
							class={`${BASE_BTN_CLS} mod-cta ep:py-2 ep:px-4`}
							onClick={onShowAnswer}
						>
							Show answer
						</button>
					) : (
						<>
							<RatingButton label="Again" rating={Rating.Again} cls={`${BASE_BTN_CLS} ep:bg-obs-red ep:text-obs-on-accent`} interval={preview?.again.interval} showInterval={showNextReviewTime} onAnswer={onAnswer} />
							<RatingButton label="Hard" rating={Rating.Hard} cls={`${BASE_BTN_CLS} ep:bg-obs-orange ep:text-obs-on-accent`} interval={preview?.hard.interval} showInterval={showNextReviewTime} onAnswer={onAnswer} />
							<RatingButton label="Good" rating={Rating.Good} cls={`${BASE_BTN_CLS} ep:bg-obs-green ep:text-obs-on-accent`} interval={preview?.good.interval} showInterval={showNextReviewTime} onAnswer={onAnswer} />
							<RatingButton label="Easy" rating={Rating.Easy} cls={`${BASE_BTN_CLS} ep:bg-obs-cyan ep:text-obs-on-accent`} interval={preview?.easy.interval} showInterval={showNextReviewTime} onAnswer={onAnswer} />
						</>
					)}
				</div>

				<button
					class="ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:border-none ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:cursor-pointer ep:transition-colors ep:absolute ep:right-0 ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95"
					aria-label="Card actions"
					onClick={onActionsMenu}
				>
					<div ref={menuIconRef} />
				</button>
			</div>
		</div>
	);
}

function RatingButton({
	label,
	rating,
	cls,
	interval,
	showInterval,
	onAnswer,
}: {
	label: string;
	rating: Grade;
	cls: string;
	interval?: string;
	showInterval: boolean;
	onAnswer: (rating: Grade) => void;
}) {
	return (
		<button class={cls} onClick={() => onAnswer(rating)}>
			<div class="ep:font-semibold">{label}</div>
			{interval && showInterval && (
				<div class="ep:text-ui-smaller ep:opacity-90">{interval}</div>
			)}
		</button>
	);
}

// ─── Waiting Screen ──────────────────────────────────────────────────────────

function WaitingScreen({
	review,
	timeUntilDue,
	onEndSession,
}: {
	review: ReviewApi;
	timeUntilDue: number;
	onEndSession: () => void;
}) {
	const [remaining, setRemaining] = useState(timeUntilDue);
	const pendingCards = review.getPendingLearningCards();

	useEffect(() => {
		const id = setInterval(() => {
			const newRemaining = review.getTimeUntilNextDue();
			if (newRemaining <= 0) {
				clearInterval(id);
			}
			setRemaining(newRemaining);
		}, UI_CONFIG.timerInterval);
		return () => clearInterval(id);
	}, [review]);

	const formatCountdown = (ms: number): string => {
		if (ms <= 0) return "0:00";
		const totalSeconds = Math.ceil(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	const btnCls = "ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto">
				<div class="ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto">
					<h2 class="ep:text-2xl ep:m-0 ep:mb-4 ep:text-obs-normal">Congratulations!</h2>
					<p class="ep:text-obs-muted ep:m-0 ep:mb-6">You've reviewed all available cards.</p>

					<div class="ep:mb-6">
						<p class="ep:text-obs-muted ep:text-ui-small ep:m-0 ep:mb-2">
							{pendingCards.length} learning card{pendingCards.length === 1 ? "" : "s"} due in:
						</p>
						<div class="ep:text-5xl ep:font-bold ep:text-obs-interactive ep:tabular-nums">
							{formatCountdown(remaining)}
						</div>
					</div>

					<div class="ep:flex ep:gap-3 ep:justify-center">
						<button class={`${btnCls} mod-cta`}>Wait</button>
						<button
							class={`${btnCls} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`}
							onClick={() => {
								review.endSession();
								onEndSession();
							}}
						>
							End session
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Summary Screen ──────────────────────────────────────────────────────────

function SummaryScreen({
	review,
	isCustomSession,
	continuousCustomReviews,
	onClose,
	onNextSession,
}: {
	review: ReviewApi;
	isCustomSession: boolean;
	continuousCustomReviews: boolean;
	onClose: () => void;
	onNextSession: () => void;
}) {
	const stats = review.getStats();
	const durationMin = Math.floor(stats.duration / 60000);
	const durationSec = Math.floor((stats.duration % 60000) / 1000);

	// End session to capture final stats
	useEffect(() => {
		if (review.isActive) {
			review.endSession();
		}
	}, [review]);

	const btnCls = "ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto">
				<div class="ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto">
					<h2 class="ep:text-2xl ep:m-0 ep:mb-6 ep:text-obs-normal">Session complete!</h2>

					<div class="ep:grid ep:grid-cols-2 ep:gap-3 ep:mb-6">
						<StatItem label="Total reviewed" value={stats.reviewed.toString()} />
						<StatItem label="Again" value={stats.again.toString()} colorCls="ep:text-obs-red" />
						<StatItem label="Hard" value={stats.hard.toString()} colorCls="ep:text-obs-orange" />
						<StatItem label="Good" value={stats.good.toString()} colorCls="ep:text-obs-green" />
						<StatItem label="Easy" value={stats.easy.toString()} colorCls="ep:text-obs-cyan" />
						<StatItem label="Duration" value={`${durationMin}m ${durationSec}s`} />
					</div>

					<div class="ep:flex ep:gap-3 ep:py-4 ep:justify-center">
						{isCustomSession && continuousCustomReviews ? (
							<>
								<button class={`${btnCls} mod-cta`} onClick={onNextSession}>
									Next session
								</button>
								<button
									class={`${btnCls} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`}
									onClick={onClose}
								>
									Finish
								</button>
							</>
						) : (
							<button class={`${btnCls} mod-cta`} onClick={onClose}>
								Close
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function StatItem({ label, value, colorCls }: { label: string; value: string; colorCls?: string }) {
	return (
		<div class="ep:p-3 ep:bg-obs-secondary ep:rounded-lg">
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1">{label}</div>
			<div class={`ep:text-xl ep:font-semibold ep:text-obs-normal ${colorCls ?? ""}`}>{value}</div>
		</div>
	);
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function ReviewEmptyState({ message, onClose }: { message: string; onClose: () => void }) {
	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto">
				<div class="ep:text-center ep:py-12 ep:px-6">
					<div class="ep:text-5xl ep:mb-4">🎉</div>
					<div class="ep:text-ui-medium ep:text-obs-muted ep:mb-6">{message}</div>
					<button
						class="ep:flex ep:flex-col ep:items-center ep:gap-1 ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small mod-cta"
						onClick={onClose}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
