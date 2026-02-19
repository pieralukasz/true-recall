import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
import type {
	BackupInfo,
	BackupService,
} from "../../services/persistence/backup.service";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";

export interface RestoreBackupResult extends CancellableResult {
	restoredPath?: string;
}

export interface RestoreBackupModalOptions {
	backups: BackupInfo[];
	backupService: BackupService;
}

function BackupItem({
	backup,
	isSelected,
	onSelect,
	onDelete,
}: {
	backup: BackupInfo;
	isSelected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	return (
		<button
			type="button"
			class={`ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ${isSelected ? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive" : ""}`}
			onClick={onSelect}
		>
			<div class="ep:flex-1 ep:overflow-hidden">
				<div class="ep:font-medium">{backup.formattedDate}</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					{backup.filename}
				</div>
			</div>
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-obs-muted">{backup.formattedSize}</span>
				<button
					type="button"
					class="ep:text-ui-smaller"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
				>
					Delete
				</button>
			</div>
		</button>
	);
}

function RestoreBackupBody({
	initialBackups,
	onResolve,
	onClose,
	onDeleteBackup,
	onRestore,
}: {
	initialBackups: BackupInfo[];
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
							onSelect={() => setSelectedBackup(backup)}
							onDelete={() => void handleDelete(backup)}
						/>
					))
				)}
			</div>

			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class={`mod-warning ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ${!selectedBackup ? "ep:opacity-50 ep:cursor-not-allowed" : ""}`}
					disabled={!selectedBackup}
					onClick={() => void handleRestore()}
				>
					Restore selected
				</button>
			</div>
		</>
	);
}

export class RestoreBackupModal extends BasePromiseModal<RestoreBackupResult> {
	private backups: BackupInfo[];
	private backupService: BackupService;
	private unmountBody?: () => void;

	constructor(app: App, options: RestoreBackupModalOptions) {
		super(app, {
			title: "Restore from backup",
			width: "500px",
		});
		this.backups = options.backups;
		this.backupService = options.backupService;
	}

	protected getDefaultResult(): RestoreBackupResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<RestoreBackupBody
				initialBackups={this.backups}
				onResolve={(result) => this.resolve(result)}
				onClose={() => this.close()}
				onDeleteBackup={(backup) => this.handleDeleteBackup(backup)}
				onRestore={(backup) => this.handleRestore(backup)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}

	private async handleDeleteBackup(backup: BackupInfo): Promise<boolean> {
		// eslint-disable-next-line no-alert
		const confirmed = confirm(`Delete backup from ${backup.formattedDate}?`);
		if (!confirmed) return false;
		return this.backupService.deleteBackup(backup.path);
	}

	private async handleRestore(backup: BackupInfo): Promise<boolean> {
		// eslint-disable-next-line no-alert
		const confirmed = confirm(
			`Are you sure you want to restore the backup from ${backup.formattedDate}?\n\n` +
				"Your current database will be replaced. A safety backup will be created first.\n\n" +
				"You will need to reload Obsidian after restoration.",
		);
		if (!confirmed) return false;
		return this.backupService.restoreFromBackup(backup.path);
	}
}
