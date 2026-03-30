import { normalizeIOImagePath } from "./io-definition";
import { isImageExtension } from "@shared/types";
import type { App } from "obsidian";
import { TFile } from "obsidian";

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
