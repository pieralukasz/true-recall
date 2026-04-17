import { useCallback, useMemo, useState } from "preact/hooks";
import { type Grade, Rating, State } from "ts-fsrs";

import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import type {
	FSRSPreset,
	FSRSSettings,
	SchedulingPreview,
} from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { ReviewAnswerCommand } from "@true-recall/obsidian/commands/commands/review-answer.cmd";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

export interface PreviewIntervals {
	again: string;
	hard: string;
	good: string;
	easy: string;
}

export interface CardPreviewHandle {
	isAnswerRevealed: boolean;
	intervals: PreviewIntervals | null;
	isGradable: boolean;
	reveal: () => void;
	grade: (rating: Grade) => void;
}

interface UseCardPreviewArgs {
	card: FSRSFlashcardItem;
	onClose: () => void;
}

const reviewService = new ReviewService();

// ── Pure helpers (tested standalone) ──

export function isCardGradable(card: FSRSFlashcardItem): boolean {
	if (card.fsrs.suspended) return false;
	if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > new Date()) {
		return false;
	}
	return true;
}

export function toPreviewIntervals(
	preview: SchedulingPreview,
): PreviewIntervals {
	return {
		again: preview.again.interval,
		hard: preview.hard.interval,
		good: preview.good.interval,
		easy: preview.easy.interval,
	};
}

export function buildStandaloneReviewCommand(args: {
	card: FSRSFlashcardItem;
	rating: Grade;
	fsrsService: FSRSService;
	preset: FSRSPreset;
	settings: FSRSSettings;
}): ReviewAnswerCommand {
	const { card, rating, fsrsService, preset, settings } = args;
	const { updatedCard, result } = reviewService.processAnswer(
		card,
		rating,
		fsrsService,
		0,
		settings,
	);
	return new ReviewAnswerCommand({
		card: { ...card },
		originalFsrs: { ...card.fsrs },
		updatedFsrs: updatedCard.fsrs,
		previousIndex: null,
		wasNewCard: card.fsrs.state === State.New,
		rating,
		previousState: card.fsrs.state,
		scheduledDays: result.scheduledDays,
		elapsedDays: result.elapsedDays,
		responseTime: 0,
		presetName: preset.name,
	});
}

// ── Hook ──

export function useCardPreview({
	card,
	onClose,
}: UseCardPreviewArgs): CardPreviewHandle {
	const plugin = usePlugin();
	const [isAnswerRevealed, setAnswerRevealed] = useState(false);
	const [intervals, setIntervals] = useState<PreviewIntervals | null>(null);

	const isGradable = isCardGradable(card);

	const reveal = useCallback(() => {
		setAnswerRevealed(true);
		if (!isGradable) return;
		const preset = plugin.presetService.resolvePresetForCard(card, {});
		const settings = plugin.presetService.toFSRSSettings(preset);
		const preview = plugin.fsrsService.getSchedulingPreview(
			card.fsrs,
			settings,
		);
		setIntervals(toPreviewIntervals(preview));
	}, [card, plugin, isGradable]);

	const grade = useCallback(
		(rating: Grade) => {
			if (!isGradable) return;
			const preset = plugin.presetService.resolvePresetForCard(card, {});
			const settings = plugin.presetService.toFSRSSettings(preset);
			const cmd = buildStandaloneReviewCommand({
				card,
				rating,
				fsrsService: plugin.fsrsService,
				preset,
				settings,
			});
			void plugin.commandService?.execute(cmd);
			notify().success(`Reviewed (${Rating[rating]})`);
			onClose();
		},
		[card, plugin, onClose, isGradable],
	);

	return useMemo(
		() => ({
			isAnswerRevealed,
			intervals,
			isGradable,
			reveal,
			grade,
		}),
		[isAnswerRevealed, intervals, isGradable, reveal, grade],
	);
}
