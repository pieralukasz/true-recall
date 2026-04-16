import type { App } from "obsidian";
import { render } from "preact";

import type { HealingSuggestion } from "@true-recall/core/ai/healing/healing.types";

import { ErrorBoundary } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import type TrueRecallPlugin from "../../../main";
import { CardHealingApp } from "./CardHealingApp";
import type { CardHealingResult } from "./types";

export class CardHealingModal extends BasePromiseModal<CardHealingResult> {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private healPromise: Promise<HealingSuggestion>,
		private originalQuestion: string,
		private originalAnswer: string,
	) {
		super(app, { title: "Heal Card", width: "560px" });
	}

	protected getDefaultResult(): CardHealingResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<ErrorBoundary>
					<CardHealingApp
						healPromise={this.healPromise}
						originalQuestion={this.originalQuestion}
						originalAnswer={this.originalAnswer}
						onDone={(result) => this.resolve(result)}
					/>
				</ErrorBoundary>
			</ObsidianProvider>,
			container,
		);
	}
}
