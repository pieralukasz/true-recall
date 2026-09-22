import { TFile } from "obsidian";

import type TrueRecallPlugin from "../../main";

const POINTER = "true-recall-practice-note";
export async function openStarterMaterial(
	plugin: TrueRecallPlugin,
): Promise<void> {
	const { app } = plugin;
	const previous = app.loadLocalStorage(POINTER);
	const existing =
		typeof previous === "string"
			? app.vault.getAbstractFileByPath(previous)
			: null;
	if (existing instanceof TFile) {
		await app.workspace.getLeaf(false).openFile(existing);
		return;
	}
	const suffix = crypto.randomUUID().slice(0, 8);
	const name = `True Recall practice ${suffix}`;
	const canvas = document.createElement("canvas");
	canvas.width = 900;
	canvas.height = 280;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Could not create the practice diagram.");
	context.fillStyle = "#171923";
	context.fillRect(0, 0, 900, 280);
	context.font = "24px sans-serif";
	context.textAlign = "center";
	for (const [index, label] of ["Encode", "Recall", "Space"].entries()) {
		context.fillStyle = "#7654cf";
		context.fillRect(30 + index * 300, 90, 240, 100);
		context.fillStyle = "#ffffff";
		context.fillText(label, 150 + index * 300, 150);
		if (index < 2) context.fillText("→", 300 + index * 300, 150);
	}
	const bytes = Uint8Array.from(
		atob(canvas.toDataURL("image/png").split(",")[1] ?? ""),
		(char) => char.charCodeAt(0),
	);
	await app.vault.createBinary(`${name}.png`, bytes.buffer);
	const note = await app.vault.create(
		`${name}.md`,
		`# Your first learning session\n\nSelect the paragraph below, choose **Ask AI**, and ask for three short flashcards. Review the drafts before applying them.\n\nRetrieval practice means trying to recall information before looking at the answer. Feedback helps correct mistakes after the attempt. Spaced repetition distributes these retrieval attempts across multiple days instead of putting them all into one session.\n\n## Image practice\n\nCreate an Image Occlusion card from this diagram and hide one label.\n\n![[${name}.png]]\n\n## Try the full loop\n\n- Generate and check three cards.\n- Review them and try a typed answer with AI feedback.\n- Make one image card.\n- Return tomorrow for a short review.\n\nYour notes and cards remain yours when the trial ends.\n`,
	);
	app.saveLocalStorage(POINTER, note.path);
	await app.workspace.getLeaf(false).openFile(note);
	await plugin.activateView();
}
