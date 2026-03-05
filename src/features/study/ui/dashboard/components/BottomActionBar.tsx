import { ActionButton } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";

const ANKI_SHARED_DECKS_URL = "https://ankiweb.net/shared/decks";

export function BottomActionBar() {
	const plugin = usePlugin();

	return (
		<div class="ep:shrink-0 ep:border-t ep:border-obs-border ep:bg-obs-primary">
			<div class="ep:flex ep:justify-center ep:gap-3 ep:px-4 ep:py-2.5">
				<ActionButton
					label="Get Shared"
					variant="secondary"
					icon="globe"
					onClick={() => window.open(ANKI_SHARED_DECKS_URL, "_blank")}
				/>
				<ActionButton
					label="Import File"
					variant="secondary"
					icon="file-down"
					onClick={() => void plugin.importAnki()}
				/>
			</div>
		</div>
	);
}
