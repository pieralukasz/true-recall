import { reportError } from "@true-recall/obsidian/services/errors";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type TrueRecallPlugin from "../../main";
import type { LocalApiServer } from "./LocalApiServer";

/** Keeps the desktop-only dynamic import and startup failure policy out of main.ts. */
export async function startLocalApi(
	plugin: TrueRecallPlugin,
	port: number,
	isCancelled: () => boolean,
): Promise<LocalApiServer | null> {
	try {
		const { LocalApiServer: ApiServer } = await import("./LocalApiServer");
		if (isCancelled()) return null;
		const server = new ApiServer(plugin, port);
		server.start();
		return server;
	} catch (error) {
		reportError(error, { origin: "local-api-start" });
		notify().error("True Recall API could not be started.");
		return null;
	}
}
