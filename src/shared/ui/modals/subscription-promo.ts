import type TrueRecallPlugin from "../../../main";

const DAY_MS = 86_400_000;
export const SNOOZE_INTERVALS_MS = [3 * DAY_MS, 14 * DAY_MS];
const MAX_SNOOZE_COUNT = SNOOZE_INTERVALS_MS.length + 1;

export async function maybeShowSubscriptionPromo(
	plugin: TrueRecallPlugin,
): Promise<void> {
	const { settings } = plugin;
	if (settings.subscriptionKey) return;

	const count = settings.subscriptionPromoSnoozeCount ?? 0;
	if (count >= MAX_SNOOZE_COUNT) return;

	const snoozedUntil = settings.subscriptionPromoSnoozedUntil ?? 0;
	if (Date.now() < snoozedUntil) return;

	setTimeout(async () => {
		const { SubscriptionPromoModal } = await import(
			"./SubscriptionPromoModal"
		);
		new SubscriptionPromoModal(plugin).open();
	}, 600);
}
