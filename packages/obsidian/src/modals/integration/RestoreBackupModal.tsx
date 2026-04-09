import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

import type {
	BackupInfo,
	BackupService,
} from "@true-recall/core/persistence/backup/backup.service";

import { Clickable } from "@true-recall/obsidian/components";
import {
	BasePromiseModal,
	type CancellableResult,
} from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";

export interface RestoreBackupResult extends CancellableResult {
	restoredPath?: string;
}

export interface RestoreBackupModalOptions {
	backups: BackupInfo[];
	backupService: BackupService;
	sessionStartBackupPath: string | null;
}

function BackupItem({
	backup,
	isSelected,
	isSessionStart,
	onSelect,
	onDelete,
}: {
	backup: BackupInfo;
	isSelected: boolean;
	isSessionStart: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	return (
		<Clickable
			stopPropagation={false}
			class={`ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ${isSelected ? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive" : ""}`}
			onClick={onSelect}
		>
			<div class="ep:flex-1 ep:overflow-hidden">
				<div class="ep:font-medium ep:flex ep:items-center ep:gap-2">
					{backup.formattedDate}
					{isSessionStart && (
						<span class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-medium">
							startup snapshot
						</span>
					)}
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					{backup.filename}
				</div>
			</div>
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-obs-muted">{backup.formattedSize}</span>
				<Clickable class="ep:text-ui-smaller" onClick={onDelete}>
					Delete
				</Clickable>
			</div>
		</Clickable>
	);
}

function RestoreBackupBody({
	initialBackups,
	sessionStartBackupPath,
	onResolve,
	onClose,
	onDeleteBackup,
	onRestore,
}: {
	initialBackups: BackupInfo[];
	sessionStartBackupPath: string | null;
	onResolve: (result: RestoreBackupResult) => void;
	onClose: () => void;
	onDeleteBackup: (backup: BackupInfo) => Promise<boolean>;
	onRestore: (backup: BackupInfo) => Promise<boolean>;
}) {
	const [backups, setBackups] = useState(initialBackups);
	const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

	const handleDelete = useCallback(
		async (backup: BackupInfo) => {
			const success = await onDeleteBackup(backup);
			if (success) {
				setBackups((prev) => prev.filter((b) => b.path !== backup.path));
				setSelectedBackup((prev) => (prev === backup ? null : prev));
			}
		},
		[onDeleteBackup],
	);

	const handleRestore = useCallback(async () => {
		if (!selectedBackup) return;
		const success = await onRestore(selectedBackup);
		if (success) {
			onResolve({ cancelled: false, restoredPath: selectedBackup.path });
		}
	}, [selectedBackup, onRestore, onResolve]);

	return (
		<>
			<div class="ep:bg-obs-modifier-error ep:p-3 ep:rounded-md ep:mb-4 ep:text-obs-on-accent">
				<p>
					Restoring a backup will replace your current database. A safety backup
					will be created automatically before restoration.
				</p>
			</div>

			<div class="ep:max-h-[300px] ep:overflow-y-auto ep:mb-4">
				{backups.length === 0 ? (
					<p class="ep:text-obs-muted ep:p-3">No backups available.</p>
				) : (
					backups.map((backup) => (
						<BackupItem
							key={backup.path}
							backup={backup}
							isSelected={selectedBackup === backup}
							isSessionStart={backup.path === sessionStartBackupPath}
							onSelect={() => setSelectedBackup(backup)}
							onDelete={() => void handleDelete(backup)}
						/>
					))
				)}
			</div>

			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
				<Clickable
					stopPropagation={false}
					class="ep-btn ep-btn-outline"
					onClick={onClose}
				>
					Cancel
				</Clickable>
				<Clickable
					stopPropagation={false}
					class="mod-warning ep-btn"
					disabled={!selectedBackup}
					onClick={() => void handleRestore()}
				>
					Restore selected
				</Clickable>
			</div>
		</>
	);
}

export class RestoreBackupModal extends BasePromiseModal<RestoreBackupResult> {
	private backups: BackupInfo[];
	private backupService: BackupService;
	private sessionStartBackupPath: string | null;

	constructor(app: App, options: RestoreBackupModalOptions) {
		super(app, {
			title: "Restore from backup",
			width: "500px",
		});
		this.backups = options.backups;
		this.backupService = options.backupService;
		this.sessionStartBackupPath = options.sessionStartBackupPath;
	}

	protected getDefaultResult(): RestoreBackupResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<RestoreBackupBody
				initialBackups={this.backups}
				sessionStartBackupPath={this.sessionStartBackupPath}
				onResolve={(result) => this.resolve(result)}
				onClose={() => this.close()}
				onDeleteBackup={(backup) => this.handleDeleteBackup(backup)}
				onRestore={(backup) => this.handleRestore(backup)}
			/>,
			container,
		);
	}

	private async handleDeleteBackup(backup: BackupInfo): Promise<boolean> {
		const confirmed = await confirm(this.app, {
			message: `Delete backup from ${backup.formattedDate}?`,
		});
		if (!confirmed) return false;
		return this.backupService.deleteBackup(backup.path);
	}

	private async handleRestore(backup: BackupInfo): Promise<boolean> {
		const confirmed = await confirm(this.app, {
			message:
				`Are you sure you want to restore the backup from ${backup.formattedDate}?\n\n` +
				"Your current database will be replaced. A safety backup will be created first.\n\n" +
				"You will need to reload Obsidian after restoration.",
		});
		if (!confirmed) return false;
		return this.backupService.restoreFromBackup(backup.path);
	}
}
