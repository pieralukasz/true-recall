import { useCallback } from "preact/hooks";
import { notify } from "../../../../../shared/services/notification.service";
import { notifyCardChange } from "../../../../../shared/services/signals";
import type { BrowserApi } from "../../../../../shared/store";
import { usePlugin } from "../../../../../shared/ui/preact";

export function useBrowserActions(browser: BrowserApi) {
	const plugin = usePlugin();

	const handleSingleSuspend = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkSuspend([cardId]);
			notifyCardChange({ type: "bulk", cardIds: [cardId], action: "suspend" });
			notify().success("Card suspended");
		},
		[plugin],
	);

	const handleSingleUnsuspend = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkUnsuspend([cardId]);
			notifyCardChange({
				type: "bulk",
				cardIds: [cardId],
				action: "unsuspend",
			});
			notify().success("Card unsuspended");
		},
		[plugin],
	);

	const handleSingleDelete = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkSoftDelete([cardId]);
			notifyCardChange({ type: "removed", cardId });
			browser.setPreviewCardId(null);
			notify().success("Card deleted");
		},
		[plugin, browser],
	);

	const handleSingleReset = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkReset([cardId]);
			notifyCardChange({ type: "bulk", cardIds: [cardId], action: "reset" });
			notify().success("Card reset to new");
		},
		[plugin],
	);

	const handleBulkSuspend = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkSuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "suspend" });
		browser.exitSelectionMode();
		notify().success(`Suspended ${ids.length} card(s)`);
	}, [plugin, browser]);

	const handleBulkUnsuspend = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkUnsuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "unsuspend" });
		browser.exitSelectionMode();
		notify().success(`Unsuspended ${ids.length} card(s)`);
	}, [plugin, browser]);

	const handleBulkReset = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkReset(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "reset" });
		browser.exitSelectionMode();
		notify().success(`Reset ${ids.length} card(s) to new`);
	}, [plugin, browser]);

	const handleBulkDelete = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkSoftDelete(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "delete" });
		browser.exitSelectionMode();
		notify().success(`Deleted ${ids.length} card(s)`);
	}, [plugin, browser]);

	return {
		handleSingleSuspend,
		handleSingleUnsuspend,
		handleSingleDelete,
		handleSingleReset,
		handleBulkSuspend,
		handleBulkUnsuspend,
		handleBulkReset,
		handleBulkDelete,
	};
}
