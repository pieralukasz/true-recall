import type { App } from "obsidian";
import { TFile } from "obsidian";

import { isImageExtension } from "@true-recall/core/types";
import { normalizeIOImagePath } from "@true-recall/core/utils/io-definition";

export function resolveImageFile(app: App, imagePath: string): TFile | null {
	const normalized = normalizeIOImagePath(imagePath);
	if (!normalized) return null;

	const direct = app.vault.getAbstractFileByPath(normalized);
	if (direct instanceof TFile && isImageExtension(direct.extension)) {
		return direct;
	}

	const filename = normalized.split("/").pop() ?? normalized;
	const byName = app.vault
		.getFiles()
		.find((file) => isImageExtension(file.extension) && file.name === filename);
	return byName ?? null;
}
