import { useEffect, useState } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

const POLL_MS = 2000;

type SaveState = "saving" | "saved" | "error";

function formatAgo(timestamp: number): string {
	const elapsed = Date.now() - timestamp;
	if (elapsed < 60_000) return "just now";
	const minutes = Math.floor(elapsed / 60_000);
	if (minutes < 60) return `${minutes}m ago`;
	return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * Compact "Saved locally / Last synced" line for the dashboard. On mobile
 * there is no status bar, so this is the only place the user can confirm a
 * review actually reached disk and when other devices were last merged.
 *
 * Tapping it starts a sync; when the last sync failed it first shows the
 * error text, which the chip itself is too small to carry.
 */
export function SyncStatusChip() {
	const plugin = usePlugin();
	const [saveState, setSaveState] = useState<SaveState>("saved");
	const [, setTick] = useState(0);

	const coordinator =
		plugin.settings.syncMode === "cloud"
			? plugin.cloudSyncManager?.coordinator
			: plugin.syncCoordinator;
	const syncEnabled = plugin.settings.syncMode !== "off" && !!coordinator;
	const isSyncing = coordinator?.isSyncing.value ?? false;
	const lastSyncedAt = coordinator?.lastSyncedAt.value ?? null;
	const syncError = coordinator?.lastError.value ?? null;

	useEffect(() => {
		const update = () => {
			const info = plugin.coreApp.cardStore?.getPersistenceDebugInfo();
			if (!info) return;
			const failed =
				info.lastFlushFailedAt !== null &&
				(info.lastFlushSucceededAt === null ||
					info.lastFlushFailedAt > info.lastFlushSucceededAt);
			setSaveState(
				failed
					? "error"
					: info.isDirty || info.flushInProgress
						? "saving"
						: "saved",
			);
			setTick((t) => t + 1);
		};
		update();
		const id = window.setInterval(update, POLL_MS);
		return () => window.clearInterval(id);
	}, [plugin]);

	if (!syncEnabled && saveState === "saved") return null;

	const saveText =
		saveState === "error"
			? "Save failed"
			: saveState === "saving"
				? "Saving…"
				: "Saved locally";

	const syncText = !syncEnabled
		? null
		: isSyncing
			? "Syncing…"
			: syncError
				? "Sync error"
				: lastSyncedAt
					? `Synced ${formatAgo(lastSyncedAt)}`
					: "Not synced yet";

	const hasProblem = saveState === "error" || (!!syncError && !isSyncing);

	const handleClick = () => {
		if (!coordinator || isSyncing) return;
		if (syncError) notify().error(`Last sync failed: ${syncError}`);
		void coordinator.syncNow("manual");
	};

	const line = (
		<>
			<span>{saveText}</span>
			{syncText && (
				<>
					<span>·</span>
					<span>{syncText}</span>
				</>
			)}
		</>
	);

	const toneClass = hasProblem ? "ep:text-obs-error" : "ep:text-obs-muted";

	if (!syncEnabled || !coordinator) {
		return (
			<div
				class={`ep:flex ep:items-center ep:justify-center ep:gap-2 ep:text-[11px] ${toneClass}`}
				aria-live="polite"
			>
				{line}
			</div>
		);
	}

	return (
		<Clickable
			class={`ep:flex ep:items-center ep:justify-center ep:gap-2 ep:text-[11px] ep:cursor-pointer ${toneClass}`}
			aria-live="polite"
			aria-label={syncError ? "Show the sync error and sync now" : "Sync now"}
			title={syncError ?? "Sync now"}
			disabled={isSyncing}
			onClick={handleClick}
		>
			{line}
		</Clickable>
	);
}
