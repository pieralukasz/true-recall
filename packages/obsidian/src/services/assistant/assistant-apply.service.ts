import { normalizePath, requestUrl, TFile } from "obsidian";

import type {
	AssistantProposal,
	AssistantTask,
	ProposalTarget,
} from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	NoteAppendCommand,
	NoteCreateCommand,
} from "../../commands/commands/assistant-note.cmd";
import { BatchCreateCommand } from "../../commands/commands/card-create.cmd";
import { UpdateNoteFieldsCommand } from "../../commands/commands/card-update.cmd";
import { resolveAttachmentFolder } from "../../utils/attachment-folder";
import { notify } from "../notification.service";
import { detectFieldConflict } from "./assistant-conflict";

export interface ApplyResult {
	ok: boolean;
	/** Non-empty when the target changed since the snapshot; UI shows a warning. */
	conflictFields?: string[];
	error?: string;
}

const IMAGE_EXT = /^(png|jpe?g|gif|webp|svg)$/;
const CARD_UPDATED_EVENT = "true-recall:assistant-card-updated";

export class AssistantApplyService {
	constructor(private plugin: TrueRecallPlugin) {}

	/**
	 * Applies one proposal. `overrides` carries user edits from the inbox
	 * (edited fields, force past a conflict). On success the caller marks the
	 * proposal `applied` in the manifest and persists it.
	 */
	async apply(
		task: AssistantTask,
		proposal: AssistantProposal,
		overrides?: { fields?: Record<string, string>; force?: boolean },
	): Promise<ApplyResult> {
		try {
			switch (proposal.type) {
				case "create_card":
					return this.applyCreateCard(task, proposal, overrides?.fields);
				case "update_card":
					return this.applyUpdateCard(proposal, overrides);
				case "append_to_note":
					return this.appendMarkdown(proposal.path, proposal.markdown);
				case "create_note":
					return await this.applyCreateNote(proposal);
				case "insert_diagram": {
					const block =
						proposal.format === "mermaid"
							? `\n\n\`\`\`mermaid\n${proposal.code}\n\`\`\``
							: `\n\n${proposal.code}`;
					return this.appendToTarget(proposal.target, block);
				}
				case "attach_images":
					return this.applyAttachImages(proposal);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			notify().error("Apply failed", error);
			return { ok: false, error: message };
		}
	}

	private applyCreateCard(
		task: AssistantTask,
		proposal: Extract<AssistantProposal, { type: "create_card" }>,
		editedFields?: Record<string, string>,
	): ApplyResult {
		const result = this.plugin.flashcardManager.createNote({
			noteTypeId: proposal.noteTypeId,
			fields: editedFields ?? proposal.fields,
			sourceUid: task.context.card?.sourceUid,
			createdVia: "ai-assistant",
			skipDuplicates: true,
		});
		void this.plugin.commandService?.execute(
			new BatchCreateCommand(result.cards.map((c) => c.id)),
		);
		return { ok: true };
	}

	private applyUpdateCard(
		proposal: Extract<AssistantProposal, { type: "update_card" }>,
		overrides?: { fields?: Record<string, string>; force?: boolean },
	): ApplyResult {
		const store = this.plugin.cardStore;
		const note = store?.notes.getById(proposal.noteId);
		if (!note) return { ok: false, error: "Card no longer exists" };
		const currentFields = note.fields ?? {};
		const conflict = detectFieldConflict(
			proposal.previousFields,
			currentFields,
		);
		if (conflict && !overrides?.force) {
			return { ok: false, conflictFields: conflict };
		}
		const merged = {
			...currentFields,
			...(overrides?.fields ?? proposal.fields),
		};
		this.plugin.flashcardManager.updateNoteFields(proposal.noteId, merged);
		void this.plugin.commandService?.execute(
			new UpdateNoteFieldsCommand(
				proposal.noteId,
				currentFields,
				"AI assistant edit",
			),
		);
		this.emitCardUpdated(proposal.cardId);
		return { ok: true };
	}

	private async applyCreateNote(
		proposal: Extract<AssistantProposal, { type: "create_note" }>,
	): Promise<ApplyResult> {
		const folder = this.plugin.settings.defaultProjectFolder?.trim() || "";
		const base = proposal.title.replace(/[\\/:*?"<>|]/g, "-");
		const path = normalizePath(folder ? `${folder}/${base}.md` : `${base}.md`);
		const file = await this.plugin.app.vault.create(path, proposal.markdown);
		const fmService = this.plugin.flashcardManager.getFrontmatterService();
		await fmService.setSourceNoteUid(file.path, fmService.generateUid());
		await this.plugin.commandService?.execute(
			new NoteCreateCommand(this.plugin.app, file.path),
		);
		return { ok: true };
	}

	private async applyAttachImages(
		proposal: Extract<AssistantProposal, { type: "attach_images" }>,
	): Promise<ApplyResult> {
		const selected = proposal.candidates.filter((c) => c.selected);
		if (selected.length === 0)
			return { ok: false, error: "No images selected" };
		const embeds: string[] = [];
		for (const candidate of selected) {
			const path = await this.downloadImage(candidate.url);
			embeds.push(`![[${path}]]`);
		}
		return this.appendToTarget(proposal.target, `\n\n${embeds.join("\n")}`);
	}

	private async appendMarkdown(
		path: string,
		markdown: string,
	): Promise<ApplyResult> {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return { ok: false, error: `Note not found: ${path}` };
		}
		const previous = await this.plugin.app.vault.read(file);
		await this.plugin.app.vault.process(file, (content) => {
			const separator = content.endsWith("\n") ? "\n" : "\n\n";
			return `${content}${separator}${markdown}\n`;
		});
		await this.plugin.commandService?.execute(
			new NoteAppendCommand(this.plugin.app, path, previous),
		);
		return { ok: true };
	}

	private appendToTarget(
		target: ProposalTarget,
		block: string,
	): Promise<ApplyResult> | ApplyResult {
		if (target.kind === "note") return this.appendMarkdown(target.path, block);
		const store = this.plugin.cardStore;
		const note = store?.notes.getById(target.noteId);
		if (!note) return { ok: false, error: "Card no longer exists" };
		const currentFields = note.fields ?? {};
		const merged = {
			...currentFields,
			[target.field]: `${currentFields[target.field] ?? ""}${block}`,
		};
		this.plugin.flashcardManager.updateNoteFields(target.noteId, merged);
		void this.plugin.commandService?.execute(
			new UpdateNoteFieldsCommand(
				target.noteId,
				currentFields,
				"AI assistant attach",
			),
		);
		this.emitCardUpdated(target.cardId);
		return { ok: true };
	}

	private async downloadImage(url: string): Promise<string> {
		const response = await requestUrl({ url });
		const attachmentFolder = resolveAttachmentFolder(
			this.plugin.settings.attachmentFolder,
			(
				this.plugin.app.vault as unknown as {
					getConfig?: (k: string) => string;
				}
			).getConfig?.("attachmentFolderPath") ?? "",
		);
		if (
			attachmentFolder &&
			!(await this.plugin.app.vault.adapter.exists(attachmentFolder))
		) {
			await this.plugin.app.vault.createFolder(attachmentFolder);
		}
		const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase();
		const safeExt = ext && IMAGE_EXT.test(ext) ? ext : "jpg";
		const filename = `ai-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
		const path = normalizePath(
			attachmentFolder ? `${attachmentFolder}/${filename}` : filename,
		);
		await this.plugin.app.vault.createBinary(path, response.arrayBuffer);
		return path;
	}

	private emitCardUpdated(cardId: string): void {
		window.dispatchEvent(
			new CustomEvent(CARD_UPDATED_EVENT, { detail: { cardId } }),
		);
	}
}
