import { render } from "preact";
import { useState, useCallback } from "preact/hooks";
import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { DeviceDatabaseInfo } from "../../services/device";

export interface DeviceSelectionResult extends CancellableResult {
	action: "fresh" | "import";
	sourceDeviceId?: string;
	sourcePath?: string;
}

export interface DeviceSelectionModalOptions {
	databases: DeviceDatabaseInfo[];
	hasLegacy: boolean;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
	});
}

function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) {
		return "just now";
	} else if (diffMinutes < 60) {
		return `${diffMinutes}min ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		return formatDate(date);
	}
}

function RadioOption({
	value,
	label,
	description,
	checked,
	onChange,
}: {
	value: string;
	label: string;
	description: string;
	checked: boolean;
	onChange: () => void;
}) {
	return (
		<div
			class={`ep:flex ep:items-start ep:gap-3 ep:p-3 ep:rounded-md ep:mb-2 ep:cursor-pointer ep:bg-obs-secondary ep:transition-colors ep:hover:bg-obs-modifier-hover ${checked ? "ep-radio-active" : ""}`}
			onClick={() => onChange()}
		>
			<input
				type="radio"
				name="device-action"
				value={value}
				checked={checked}
				class="ep:mt-0.5 ep:shrink-0"
				onChange={onChange}
				onClick={(e) => e.stopPropagation()}
			/>
			<div>
				<div class="ep:font-medium">{label}</div>
				<div class="setting-item-description ep:mt-0.5">{description}</div>
			</div>
		</div>
	);
}

function DatabaseItem({
	db,
	isSelected,
	onSelect,
}: {
	db: DeviceDatabaseInfo;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const statsParts: string[] = [];
	if (db.cardCount !== null) {
		statsParts.push(`${db.cardCount.toLocaleString()} cards`);
	}
	if (db.lastReviewDate) {
		statsParts.push(`Last: ${formatDate(db.lastReviewDate)}`);
	}

	return (
		<div
			class={`ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ${isSelected ? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive" : ""}`}
			onClick={onSelect}
		>
			<div>
				<div class="ep:flex ep:items-center ep:gap-2">
					<span>device</span>
					<span class="ep:font-mono">{db.deviceId}</span>
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:mt-1">{statsParts.join(" | ")}</div>
			</div>
			<div class="ep:text-right ep:text-ui-smaller ep:text-obs-muted">
				<div>{db.formattedSize}</div>
				<div>Mod: {formatRelativeTime(db.lastModified)}</div>
			</div>
		</div>
	);
}

function DeviceSelectionBody({
	databases,
	onResolve,
	onClose,
}: {
	databases: DeviceDatabaseInfo[];
	onResolve: (result: DeviceSelectionResult) => void;
	onClose: () => void;
}) {
	const [selectedAction, setSelectedAction] = useState<"fresh" | "import">("fresh");
	const [selectedDatabase, setSelectedDatabase] = useState<DeviceDatabaseInfo | null>(null);

	const canContinue = selectedAction === "fresh" ||
		(selectedAction === "import" && selectedDatabase !== null);

	const handleContinue = useCallback(() => {
		if (selectedAction === "fresh") {
			onResolve({ cancelled: false, action: "fresh" });
		} else if (selectedAction === "import" && selectedDatabase) {
			onResolve({
				cancelled: false,
				action: "import",
				sourceDeviceId: selectedDatabase.deviceId,
				sourcePath: selectedDatabase.path,
			});
		}
	}, [selectedAction, selectedDatabase, onResolve]);

	return (
		<>
			<div class="ep:mb-4">
				<p>Choose how to initialize the database on this device:</p>
			</div>

			<div>
				<RadioOption
					value="fresh"
					label="Start fresh"
					description="Create a new, empty database"
					checked={selectedAction === "fresh"}
					onChange={() => setSelectedAction("fresh")}
				/>

				{databases.length > 0 && (
					<RadioOption
						value="import"
						label="Import from another device"
						description="Copy data from an existing database"
						checked={selectedAction === "import"}
						onChange={() => setSelectedAction("import")}
					/>
				)}
			</div>

			{selectedAction === "import" && databases.length > 0 && (
				<div class="ep:ml-7 ep:mt-2 ep:mb-4">
					{databases.map(db => (
						<DatabaseItem
							key={db.deviceId}
							db={db}
							isSelected={selectedDatabase === db}
							onSelect={() => setSelectedDatabase(db)}
						/>
					))}
				</div>
			)}

			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={onClose}
				>
					Cancel
				</button>
				<button
					class={`mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ${!canContinue ? "ep:opacity-50 ep:cursor-not-allowed" : ""}`}
					disabled={!canContinue}
					onClick={handleContinue}
				>
					Continue
				</button>
			</div>
		</>
	);
}

export class DeviceSelectionModal extends BasePromiseModal<DeviceSelectionResult> {
	private databases: DeviceDatabaseInfo[];
	private hasLegacy: boolean;
	private unmountBody?: () => void;

	constructor(app: App, options: DeviceSelectionModalOptions) {
		super(app, {
			title: "True Recall database setup",
			width: "480px",
		});
		this.databases = options.databases;
		this.hasLegacy = options.hasLegacy;
	}

	protected getDefaultResult(): DeviceSelectionResult {
		return { cancelled: true, action: "fresh" };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<DeviceSelectionBody
				databases={this.databases}
				onResolve={(result) => this.resolve(result)}
				onClose={() => this.close()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
