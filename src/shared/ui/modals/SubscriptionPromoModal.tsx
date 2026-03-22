import { TRUERECALL_WEB_URL } from "@shared/constants";
import { Clickable } from "@shared/ui/components";
import { BaseModal } from "@shared/ui/modals/BaseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import { render } from "preact";
import type TrueRecallPlugin from "../../../main";
import { SNOOZE_INTERVALS_MS } from "./subscription-promo";

const PRICING_URL = `${TRUERECALL_WEB_URL}/pricing`;

function PromoBody({ onClose }: { onClose: () => void }) {
	return (
		<>
			<p class="ep:text-obs-normal ep:mb-4 ep:leading-relaxed">
				You're creating flashcards with your own API key — that works! But
				True Recall subscription uses carefully crafted prompts that
				produce <strong>significantly better flashcards</strong>.
			</p>

			<ul class="ep:list-none ep:p-0 ep:m-0 ep:mb-4 ep:space-y-2">
				<li class="ep:flex ep:items-start ep:gap-2">
					<span class="ep:text-obs-accent ep:mt-0.5">&#10003;</span>
					<span>
						<strong>50 free generations</strong> — try it and compare
						quality yourself
					</span>
				</li>
				<li class="ep:flex ep:items-start ep:gap-2">
					<span class="ep:text-obs-accent ep:mt-0.5">&#10003;</span>
					<span>
						Expert-level flashcards optimized for long-term retention
					</span>
				</li>
				<li class="ep:flex ep:items-start ep:gap-2">
					<span class="ep:text-obs-accent ep:mt-0.5">&#10003;</span>
					<span>
						Your data stays <strong>private</strong> — no third-party
						API keys needed
					</span>
				</li>
				<li class="ep:flex ep:items-start ep:gap-2">
					<span class="ep:text-obs-accent ep:mt-0.5">&#10003;</span>
					<span>Works instantly — no setup or configuration required</span>
				</li>
			</ul>

			<div class="ep:flex ep:justify-end ep:gap-2 ep:mt-4 ep:pt-3 ep:border-t ep:border-obs-border">
				<Clickable
					stopPropagation={false}
					class="ep-btn ep-btn-outline"
					onClick={onClose}
				>
					Maybe Later
				</Clickable>
				<Clickable
					stopPropagation={false}
					class="mod-cta ep-btn"
					onClick={() => {
						window.open(PRICING_URL);
						onClose();
					}}
				>
					Try Free
				</Clickable>
			</div>
		</>
	);
}

export class SubscriptionPromoModal extends BaseModal {
	constructor(private readonly plugin: TrueRecallPlugin) {
		super(plugin.app, {
			title: "Get Better Flashcards",
			width: "480px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider
				value={{ app: this.plugin.app, plugin: this.plugin }}
			>
				<PromoBody onClose={() => this.close()} />
			</ObsidianProvider>,
			container,
		);
	}

	onClose(): void {
		super.onClose();
		const count = this.plugin.settings.subscriptionPromoSnoozeCount ?? 0;
		const newCount = count + 1;
		this.plugin.settings.subscriptionPromoSnoozeCount = newCount;
		if (count < SNOOZE_INTERVALS_MS.length) {
			this.plugin.settings.subscriptionPromoSnoozedUntil =
				Date.now() + SNOOZE_INTERVALS_MS[count]!;
		}
		void this.plugin.saveSettings();
	}
}
