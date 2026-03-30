import type { DeviceDatabaseInfo } from "@true-recall/core/integration/device/device-discovery.service";
import { ModalFooter } from "@true-recall/obsidian/components/ModalFooter";
import { DatabaseItem } from "@true-recall/obsidian/modals/integration/device-selection/DatabaseItem";
import { RadioOption } from "@true-recall/obsidian/modals/integration/device-selection/RadioOption";
import {
	BasePromiseModal,
	type CancellableResult,
} from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

export interface DeviceSelectionResult extends CancellableResult {
	action: "fresh" | "import";
	sourceDeviceId?: string;
	sourcePath?: string;
}

export interface DeviceSelectionModalOptions {
	databases: DeviceDatabaseInfo[];
	hasLegacy: boolean;
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
	const [selectedAction, setSelectedAction] = useState<"fresh" | "import">(
		"fresh",
	);
	const [selectedDatabase, setSelectedDatabase] =
		useState<DeviceDatabaseInfo | null>(null);

	const canContinue =
		selectedAction === "fresh" ||
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
					{databases.map((db) => (
						<DatabaseItem
							key={db.deviceId}
							db={db}
							isSelected={selectedDatabase === db}
							onSelect={() => setSelectedDatabase(db)}
						/>
					))}
				</div>
			)}

			<ModalFooter
				onCancel={onClose}
				onConfirm={handleContinue}
				confirmLabel="Continue"
				confirmDisabled={!canContinue}
			/>
		</>
	);
}

export class DeviceSelectionModal extends BasePromiseModal<DeviceSelectionResult> {
	private databases: DeviceDatabaseInfo[];
	private hasLegacy: boolean;

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
	}
}
