import type { CardAIService } from "./card-ai.service";
import {
	CardAIParseError,
	type CardAIPreset,
	type CardFields,
} from "./card-ai.types";
import type { CardAIContextCollector } from "./card-ai-context";
import type { CardAIPresenter } from "./card-ai-presenter";
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
		const context = await this.collector.collect(preset, this.target);

		const call = (prompt: string): Promise<CardFields> =>
			this.service
				.transform({
					fields: original,
					prompt,
					operation: this.target.getOperation(),
					context,
					signal,
				})
				.then((r) => r.fields);

		let proposed: CardFields | null = null;
		let rawResponse: string | undefined;
		try {
			proposed = await call(preset.prompt);
		} catch (err) {
			if (err instanceof CardAIParseError) rawResponse = err.rawResponse;
			else throw err;
		}

		const retry = (extra: string): Promise<CardFields> =>
			call(`${preset.prompt}\n\nAdditional instruction: ${extra}`);

		await this.presenter.present({
			target: this.target,
			original,
			proposed,
			rawResponse,
			autoApply: preset.autoApply,
			retry,
		});
	}
}
