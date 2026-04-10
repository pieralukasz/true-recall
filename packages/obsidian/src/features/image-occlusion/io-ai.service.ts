import { type App, TFile } from "obsidian";

import {
	detectRegionsFromImage,
	getMimeType,
} from "@true-recall/core/ai/vision/image-region-detection";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";
import type { IORegion } from "./types";

async function imageToBase64(
	app: App,
	imagePath: string,
): Promise<{ base64: string; mimeType: string }> {
	const file = app.vault.getAbstractFileByPath(imagePath);
	if (!(file instanceof TFile)) throw new Error("Image file not found");

	const arrayBuffer = await app.vault.readBinary(file);
	const bytes = new Uint8Array(arrayBuffer);

	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	const base64 = btoa(binary);
	const mimeType = getMimeType(file.extension);

	return { base64, mimeType };
}

export async function detectRegions(
	app: App,
	imagePath: string,
	settings: TrueRecallSettings,
	customHint?: string,
	settingsPrompt?: string,
): Promise<IORegion[]> {
	const { base64, mimeType } = await imageToBase64(app, imagePath);

	return detectRegionsFromImage({
		base64,
		mimeType,
		settings,
		httpClient: new ObsidianHttpClient(),
		customHint,
		settingsPrompt,
	});
}
