import { useEffect, useState } from "preact/hooks";

import { FormCard, InfoBlock } from "@true-recall/obsidian/components";

import { useSettings } from "../../hooks/useSettings";
import { StatusList } from "./StatusList";

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
		const id = window.setInterval(
			() => setDiag(plugin.getStorageDiagnostics()),
			5000,
		);
		return () => window.clearInterval(id);
	}, [plugin]);

	return (
		<FormCard title="Storage diagnostics" class="tr-setting-section--status">
			<InfoBlock>
				Read-only diagnostics for save/restore behavior in this session.
			</InfoBlock>
			<StatusList
				items={[
					{
						label: "Active database path",
						value: fmtPath(diag.activeDatabasePath),
						code: true,
						wide: true,
					},
					{
						label: "Dirty state",
						value: diag.isDirty ? "Yes" : "No",
						tone: diag.isDirty ? "default" : "positive",
					},
					{
						label: "Save timer active",
						value: diag.saveTimerActive ? "Yes" : "No",
						tone: diag.saveTimerActive ? "positive" : "muted",
					},
					{
						label: "Flush in progress",
						value: diag.flushInProgress ? "Yes" : "No",
						tone: diag.flushInProgress ? "default" : "muted",
					},
					{ label: "Last flush started", value: fmt(diag.lastFlushStartedAt) },
					{
						label: "Last flush success",
						value: fmt(diag.lastFlushSucceededAt),
					},
					{
						label: "Last flush failure",
						value: fmt(diag.lastFlushFailedAt),
						tone: diag.lastFlushFailedAt ? "default" : "muted",
					},
					{
						label: "Last flush error",
						value: diag.lastFlushError ?? "N/A",
						tone: diag.lastFlushError ? "default" : "muted",
					},
					{
						label: "Startup snapshot path",
						value: fmtPath(diag.startupSnapshotPath),
						code: true,
						wide: true,
					},
					{
						label: "Last auto-recovery backup path",
						value: fmtPath(diag.lastAutoRecoveryPath),
						code: true,
						wide: true,
					},
					{
						label: "Last auto-recovery at",
						value: fmt(diag.lastAutoRecoveryAt),
					},
				]}
			/>
		</FormCard>
	);
}
