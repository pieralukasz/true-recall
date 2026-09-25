import { notify } from "@true-recall/obsidian/services/notification.service";

import type TrueRecallPlugin from "../../main";
import { AIAuthService } from "./ai-auth.service";
import { FirstSessionModal } from "./first-session";

const services = new WeakMap<TrueRecallPlugin, AIAuthService>();
function service(plugin: TrueRecallPlugin): AIAuthService {
	let auth = services.get(plugin);
	if (!auth) {
		auth = new AIAuthService(plugin.app, () => ({
			id: plugin.deviceIdService?.getDeviceId() ?? "unknown-device",
			name: plugin.deviceIdService?.getDisplayName() ?? "True Recall device",
		}));
		services.set(plugin, auth);
	}
	return auth;
}
export async function beginAITrial(plugin: TrueRecallPlugin): Promise<void> {
	if (plugin.settings.proKey && plugin.settings.providerType === "pro") {
		new FirstSessionModal(plugin).open();
		return;
	}
	try {
		const url = await service(plugin).start();
		window.open(url, "_blank");
		notify().info(
			"Finish signing in in your browser, then return to Obsidian.",
		);
	} catch (error) {
		notify().operationFailed("start AI sign-in", error);
	}
}
export function registerAIOnboarding(plugin: TrueRecallPlugin): void {
	plugin.registerObsidianProtocolHandler("true-recall-start", () => {
		void beginAITrial(plugin);
	});
	let exchanging = false;
	let completed: string | undefined;
	plugin.registerObsidianProtocolHandler("true-recall-ai-auth", (params) => {
		if (exchanging || params.state === completed) return;
		if (!params.code || !params.state) {
			notify().error(
				"AI sign-in returned an invalid response. Start again from Try AI.",
			);
			return;
		}
		const { code, state } = params;
		exchanging = true;
		void (async () => {
			try {
				const proKey = await service(plugin).exchange(code, state);
				await plugin.saveSettings({ proKey, providerType: "pro" });
				completed = state;
				notify().success(
					"AI is connected. Your existing cards and provider keys are preserved.",
				);
				new FirstSessionModal(plugin).open();
			} catch (error) {
				notify().operationFailed("connect AI", error);
			} finally {
				exchanging = false;
			}
		})();
	});
	plugin.addCommand({
		id: "try-ai",
		name: "Try AI for free",
		callback: () => void beginAITrial(plugin),
	});
	plugin.addCommand({
		id: "first-learning-session",
		name: "First learning session",
		callback: () => new FirstSessionModal(plugin).open(),
	});
}
