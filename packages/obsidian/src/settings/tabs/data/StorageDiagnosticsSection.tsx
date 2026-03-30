import { useSettings } from "../../hooks/useSettings";
import { FormCard } from "@shared/ui/components";
import { useEffect, useState } from "preact/hooks";

function fmt(value: number | null): string {
	return value ? new Date(value).toLocaleString() : "N/A";
}

function fmtPath(path: string | null): string {
	return path ?? "N/A";
}

export function StorageDiagnosticsSection() {
	const { plugin } = useSettings();
	const [diag, setDiag] = useState(() => plugin.getStorageDiagnostics());

	useEffect(() => {
		setDiag(plugin.getStorageDiagnostics());
		const id = setInterval(() => setDiag(plugin.getStorageDiagnostics()), 5000);
		return () => clearInterval(id);
	}, [plugin]);

	return (
		<FormCard title="Storage diagnostics">
			<p class="ep:text-ui-smaller ep:text-obs-muted">
				Read-only diagnostics for save/restore behavior in this session.
			</p>
			<p>Active database path: {fmtPath(diag.activeDatabasePath)}</p>
			<p>Dirty state: {diag.isDirty ? "yes" : "no"}</p>
			<p>Save timer active: {diag.saveTimerActive ? "yes" : "no"}</p>
			<p>Flush in progress: {diag.flushInProgress ? "yes" : "no"}</p>
			<p>Last flush started: {fmt(diag.lastFlushStartedAt)}</p>
			<p>Last flush success: {fmt(diag.lastFlushSucceededAt)}</p>
			<p>Last flush failure: {fmt(diag.lastFlushFailedAt)}</p>
			<p>Last flush error: {diag.lastFlushError ?? "N/A"}</p>
			<p>Startup snapshot path: {fmtPath(diag.startupSnapshotPath)}</p>
			<p>
				Last auto-recovery backup path: {fmtPath(diag.lastAutoRecoveryPath)}
			</p>
			<p>Last auto-recovery at: {fmt(diag.lastAutoRecoveryAt)}</p>
		</FormCard>
	);
}
