import { useCallback, useState } from "preact/hooks";

import type { SchedulingResult } from "@true-recall/core/metrics/fsrs-tools/scheduler/scheduler.types";

import { FSRSHelperCommand } from "@true-recall/obsidian/commands/commands/fsrs-helper.cmd";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";

interface FsrsHelperOpConfig {
	plugin: FsrsPluginHost;
	operationName: string;
	undoDescription: (affectedCount: number) => string;
	successMessage: (affectedCount: number) => string;
	emptyMessage: string;
	errorPrefix: string;
}

export function useFsrsHelperOp(config: FsrsHelperOpConfig) {
	const [running, setRunning] = useState(false);
	const [lastAffectedCount, setLastAffectedCount] = useState(0);

	const execute = useCallback(
		(helperCall: () => SchedulingResult | undefined) => {
			setRunning(true);
			try {
				const result = helperCall();
				if (result && result.affectedCount > 0) {
					const cmd = new FSRSHelperCommand(
						config.undoDescription(result.affectedCount),
						result.changes.map((c) => ({
							cardId: c.cardId,
							originalDue: c.originalDue,
							newDue: c.newDue,
						})),
					);
					void config.plugin.commandService?.execute(cmd);
					notify().success(config.successMessage(result.affectedCount));
					setLastAffectedCount(result.affectedCount);
				} else if (result) {
					notify().info(config.emptyMessage);
				}
			} catch (err) {
				notify().error(`${config.errorPrefix}: ${String(err)}`);
			} finally {
				setRunning(false);
			}
		},
		[config],
	);

	const undoLast = useCallback(async () => {
		const ok = await config.plugin.commandService?.undo();
		if (ok) setLastAffectedCount(0);
	}, [config.plugin]);

	return { running, execute, lastAffectedCount, undoLast };
}
