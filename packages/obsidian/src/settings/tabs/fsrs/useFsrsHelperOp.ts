import type { SchedulingResult } from "@true-recall/core/metrics/fsrs-tools/scheduler/scheduler.types";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { FSRSHelperOperationType } from "@true-recall/obsidian/services/undo.types";
import type { FsrsPluginHost } from "../../../types/plugin-host.types";
import { useCallback, useState } from "preact/hooks";

interface FsrsHelperOpConfig {
	plugin: FsrsPluginHost;
	operationName: FSRSHelperOperationType;
	undoDescription: (affectedCount: number) => string;
	successMessage: (affectedCount: number) => string;
	emptyMessage: string;
	errorPrefix: string;
}

/**
 * Shared pattern: call an fsrsHelper method, push undo entry, show notification.
 * Used by LoadBalance, SiblingDisperse, and BulkOperations sections which all
 * follow the same execute -> undo -> notify flow.
 */
export function useFsrsHelperOp(config: FsrsHelperOpConfig) {
	const [running, setRunning] = useState(false);

	const execute = useCallback(
		(helperCall: () => SchedulingResult | undefined) => {
			setRunning(true);
			try {
				const result = helperCall();
				if (result && result.affectedCount > 0) {
					config.plugin.undoService?.push({
						id: crypto.randomUUID(),
						actionType: "fsrs-helper-operation",
						description: config.undoDescription(result.affectedCount),
						timestamp: Date.now(),
						payload: {
							type: "fsrs-helper-operation",
							operation: config.operationName,
							changes: result.changes.map((c) => ({
								cardId: c.cardId,
								originalDue: c.originalDue,
								newDue: c.newDue,
							})),
						},
					});
					notify().success(config.successMessage(result.affectedCount));
				} else if (result) {
					notify().info(config.emptyMessage);
				}
			} catch (err) {
				notify().error(`${config.errorPrefix}: ${String(err)}`);
			} finally {
				setRunning(false);
			}
		},
		[
			config.plugin,
			config.operationName,
			config.undoDescription,
			config.successMessage,
			config.emptyMessage,
			config.errorPrefix,
		],
	);

	return { running, execute };
}
