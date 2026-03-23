import type TrueRecallPlugin from "../../../main";

let shownThisSession = false;

export async function maybeShowSubscriptionPromo(
	plugin: TrueRecallPlugin,
): Promise<void> {
	if (plugin.settings.openRouterApiKey) return;
	if (shownThisSession) return;
	shownThisSession = true;

	setTimeout(async () => {
		const { SubscriptionPromoModal } = await import(
			"./SubscriptionPromoModal"
		);
		new SubscriptionPromoModal(plugin).open();
	}, 600);
}
