import {
	TRUERECALL_LOGIN_URL,
	TRUERECALL_PRO_GUIDE_URL,
} from "@true-recall/core/constants";
import type { TrueRecallSettings } from "@true-recall/core/types";

import { Clickable, IconButton } from "@true-recall/obsidian/components";
import { resolveAccessTier } from "@true-recall/obsidian/plugin/plugin-utils";
import { usePlugin } from "@true-recall/obsidian/preact";

interface ProIntroBannerProps {
	settings: TrueRecallSettings;
}

/** One-time bar for users without any AI key. Explains that review and
 * scheduling are free and where AI comes from, then stays dismissed. */
export function ProIntroBanner({ settings }: ProIntroBannerProps) {
	const plugin = usePlugin();

	if (settings.isProIntroDismissed) return null;
	if (resolveAccessTier(settings) !== "free") return null;

	const handleDismiss = () => {
		plugin.settings.isProIntroDismissed = true;
		void plugin.saveSettings();
	};

	return (
		<div
			class="ep:flex ep:flex-wrap ep:items-center ep:gap-x-3 ep:gap-y-2 ep:px-3 ep:py-2 ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-modifier-hover/40 ep:text-sm"
			role="status"
		>
			<span class="ep:flex-1 ep:min-w-[200px] ep:text-obs-normal">
				Review and scheduling are free forever. Want AI flashcards? Add your own
				API key, or try True Recall Pro free: about 100 cards, no credit card.
			</span>
			<div class="ep:flex ep:items-center ep:gap-2">
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={() => window.open(TRUERECALL_PRO_GUIDE_URL, "_blank")}
				>
					What Pro includes
				</Clickable>
				<Clickable
					class="mod-cta ep-btn"
					onClick={() => window.open(TRUERECALL_LOGIN_URL, "_blank")}
				>
					Try Pro free
				</Clickable>
				<IconButton
					icon="x"
					size="small"
					ariaLabel="Dismiss"
					onClick={handleDismiss}
				/>
			</div>
		</div>
	);
}
