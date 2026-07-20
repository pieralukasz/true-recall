import type { CardAIService } from "./card-ai.service";
import {
	CardAIParseError,
	type CardAIPreset,
	type CardAIResult,
	type CardFields,
	deepEqualFields,
} from "./card-ai.types";
import type { CardAIContextCollector } from "./card-ai-context";
import type { CardAIPresenter, CardAIRetryResult } from "./card-ai-presenter";
import type { CardAITarget } from "./card-ai-target";

export class CardAIRunner {
	constructor(
		private readonly target: CardAITarget,
		private readonly service: CardAIService,
		private readonly collector: CardAIContextCollector,
		private readonly presenter: CardAIPresenter,
	) {}

	async run(preset: CardAIPreset, signal?: AbortSignal): Promise<void> {
		const original = this.target.getFields();
		const noteType = this.target.getNoteType();
		const context = await this.collector.collect(preset, this.target);

		const call = (prompt: string): Promise<CardAIResult> =>
			this.service.transform({
				fields: original,
				noteType: { name: noteType.name, fields: noteType.fields },
				prompt,
				operation: this.target.getOperation(),
				context,
				signal,
			});

		let result: CardAIResult | null = null;
		let rawResponse: string | undefined;
		try {
			result = await call(preset.prompt);
		} catch (err) {
			if (err instanceof CardAIParseError) rawResponse = err.rawResponse;
			else throw err;
		}

		const cards: CardFields[] = result?.cards ?? [];
		const head: CardFields | undefined = cards[0];
		const rest: CardFields[] = cards.slice(1);
		const editsHappened = head ? !deepEqualFields(head, original) : false;

		const retry = async (extra: string): Promise<CardAIRetryResult> => {
			const r = await call(
				`${preset.prompt}\n\nAdditional instruction: ${extra}`,
			);
			const [h, ...t] = r.cards;
			return { edits: h ?? original, newCards: t };
		};

		await this.presenter.present({
			target: this.target,
			original,
			proposed: editsHappened ? (head ?? null) : null,
			proposedNewCards: rest,
			rawResponse,
			autoApplyEdits: preset.autoApply,
			autoApplyNewCards: preset.autoApplyNewCards ?? false,
			retry,
		});
	}
}
