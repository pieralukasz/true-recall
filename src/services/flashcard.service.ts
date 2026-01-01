/**
 * Flashcard Manager Service
 * Handles flashcard file operations in the Obsidian vault
 */
import { App, TFile, normalizePath, WorkspaceLeaf } from "obsidian";
import { FLASHCARD_CONFIG } from "../constants";
import { type FlashcardItem, type FlashcardChange } from "../validation";
import { FileError } from "../errors";
import type { ShadowAnkiSettings } from "../types";

/**
 * Flashcard file information
 */
export interface FlashcardInfo {
    exists: boolean;
    filePath: string;
    cardCount: number;
    questions: string[];
    flashcards: FlashcardItem[];
    lastModified: number | null;
}

/**
 * Service for managing flashcard files in the vault
 */
export class FlashcardManager {
    private app: App;
    private settings: ShadowAnkiSettings;

    constructor(app: App, settings: ShadowAnkiSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Update settings reference
     */
    updateSettings(settings: ShadowAnkiSettings): void {
        this.settings = settings;
    }

    /**
     * Get the flashcard file path for a source note
     */
    getFlashcardPath(sourceFile: TFile): string {
        const baseName = sourceFile.basename;
        return normalizePath(
            `${this.settings.flashcardsFolder}/${FLASHCARD_CONFIG.filePrefix}${baseName}.md`
        );
    }

    /**
     * Get flashcard file info for a source note
     */
    async getFlashcardInfo(sourceFile: TFile): Promise<FlashcardInfo> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            return this.createEmptyFlashcardInfo(flashcardPath);
        }

        return this.parseFlashcardFile(flashcardFile);
    }

    /**
     * Get flashcard info directly from a flashcard file
     */
    async getFlashcardInfoDirect(flashcardFile: TFile): Promise<FlashcardInfo> {
        return this.parseFlashcardFile(flashcardFile);
    }

    /**
     * Extract source note content from flashcard file (stored in HTML comment)
     */
    async extractSourceContent(sourceFile: TFile): Promise<string | null> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            return null;
        }

        const content = await this.app.vault.read(flashcardFile);
        const pattern = new RegExp(
            `${FLASHCARD_CONFIG.sourceContentStartMarker}\\n([\\s\\S]*?)\\n${FLASHCARD_CONFIG.sourceContentEndMarker}`
        );
        const match = content.match(pattern);
        return match?.[1] ?? null;
    }

    /**
     * Update or add source content in flashcard file
     */
    async updateSourceContent(sourceFile: TFile, noteContent: string): Promise<void> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            return;
        }

        const content = await this.app.vault.read(flashcardFile);
        const sourceBlock = this.generateSourceContentBlock(noteContent);
        const pattern = new RegExp(
            `${FLASHCARD_CONFIG.sourceContentStartMarker}\\n[\\s\\S]*?\\n${FLASHCARD_CONFIG.sourceContentEndMarker}`
        );
        const existingMatch = content.match(pattern);

        let newContent: string;
        if (existingMatch) {
            newContent = content.replace(existingMatch[0], sourceBlock.trim());
        } else {
            newContent = content.trimEnd() + "\n" + sourceBlock;
        }

        await this.app.vault.modify(flashcardFile, newContent);
    }

    /**
     * Create a new flashcard file
     */
    async createFlashcardFile(sourceFile: TFile, flashcardContent: string): Promise<TFile> {
        await this.ensureFolderExists();

        const flashcardPath = this.getFlashcardPath(sourceFile);
        const frontmatter = this.generateFrontmatter(sourceFile);
        const fullContent = frontmatter + flashcardContent;

        const existing = this.app.vault.getAbstractFileByPath(flashcardPath);
        if (existing instanceof TFile) {
            await this.app.vault.modify(existing, fullContent);
            return existing;
        }

        return await this.app.vault.create(flashcardPath, fullContent);
    }

    /**
     * Append new flashcards to existing file
     */
    async appendFlashcards(sourceFile: TFile, newFlashcardContent: string): Promise<TFile> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            return await this.createFlashcardFile(sourceFile, newFlashcardContent);
        }

        const existingContent = await this.app.vault.read(flashcardFile);
        const updatedContent = existingContent.trimEnd() + "\n\n" + newFlashcardContent;
        await this.app.vault.modify(flashcardFile, updatedContent);

        return flashcardFile;
    }

    /**
     * Open flashcard file
     */
    async openFlashcardFile(sourceFile: TFile): Promise<void> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (flashcardFile instanceof TFile) {
            const leaf = this.getLeafForFile(flashcardFile);
            await leaf.openFile(flashcardFile);
            this.app.workspace.setActiveLeaf(leaf, { focus: true });
        }
    }

    /**
     * Open flashcard file at a specific line for editing
     */
    async openFlashcardFileAtLine(sourceFile: TFile, lineNumber: number): Promise<void> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (flashcardFile instanceof TFile) {
            await this.openFileAtLine(flashcardFile, lineNumber);
        }
    }

    /**
     * Open any file at a specific line
     */
    async openFileAtLine(file: TFile, lineNumber: number): Promise<void> {
        const leaf = this.getLeafForFile(file);
        await leaf.openFile(file);
        this.app.workspace.setActiveLeaf(leaf, { focus: true });

        const view = leaf.view;
        if (view && "editor" in view) {
            const editor = (view as { editor: { setCursor: (pos: { line: number; ch: number }) => void } }).editor;
            editor.setCursor({ line: lineNumber - 1, ch: 0 });
        }
    }

    /**
     * Remove a flashcard from the file by its line number
     */
    async removeFlashcard(sourceFile: TFile, lineNumber: number): Promise<boolean> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            return false;
        }

        return this.removeFlashcardDirect(flashcardFile, lineNumber);
    }

    /**
     * Remove a flashcard directly from a flashcard file
     */
    async removeFlashcardDirect(flashcardFile: TFile, lineNumber: number): Promise<boolean> {
        if (!(flashcardFile instanceof TFile)) {
            return false;
        }

        const content = await this.app.vault.read(flashcardFile);
        const lines = content.split("\n");

        const startIndex = lineNumber - 1;
        if (startIndex < 0 || startIndex >= lines.length) {
            return false;
        }

        // Find the end of this flashcard block
        let endIndex = startIndex + 1;
        while (endIndex < lines.length) {
            const line = lines[endIndex] ?? "";
            if (line.trim() === "" || this.isFlashcardLine(line)) {
                break;
            }
            endIndex++;
        }

        // Remove trailing empty lines
        while (endIndex < lines.length && (lines[endIndex] ?? "").trim() === "") {
            endIndex++;
        }

        lines.splice(startIndex, endIndex - startIndex);
        const newContent = lines.join("\n");
        await this.app.vault.modify(flashcardFile, newContent);

        return true;
    }

    /**
     * Apply accepted diff changes to the flashcard file
     */
    async applyDiffChanges(
        sourceFile: TFile,
        changes: FlashcardChange[],
        _existingFlashcards: FlashcardItem[]
    ): Promise<TFile> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            throw new FileError("Flashcard file not found", flashcardPath, "read");
        }

        const content = await this.app.vault.read(flashcardFile);
        let lines = content.split("\n");

        // Process DELETED changes first (sort by line number descending)
        lines = this.processDeletedChanges(lines, changes);

        // Process MODIFIED changes (sort by line number descending)
        lines = this.processModifiedChanges(lines, changes);

        // Process NEW changes (append at end)
        lines = this.processNewChanges(lines, changes);

        const newContent = lines.join("\n").trimEnd() + "\n";
        await this.app.vault.modify(flashcardFile, newContent);

        return flashcardFile;
    }

    // ===== Private Helper Methods =====

    private createEmptyFlashcardInfo(filePath: string): FlashcardInfo {
        return {
            exists: false,
            filePath,
            cardCount: 0,
            questions: [],
            flashcards: [],
            lastModified: null,
        };
    }

    private async parseFlashcardFile(file: TFile): Promise<FlashcardInfo> {
        const content = await this.app.vault.read(file);
        const flashcards = this.extractFlashcards(content);
        const questions = flashcards.map((f) => f.question);

        return {
            exists: true,
            filePath: file.path,
            cardCount: flashcards.length,
            questions,
            flashcards,
            lastModified: file.stat.mtime,
        };
    }

    private extractFlashcards(content: string): FlashcardItem[] {
        const flashcards: FlashcardItem[] = [];
        const lines = content.split("\n");
        const flashcardPattern = new RegExp(`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            const match = line.match(flashcardPattern);

            if (match?.[1]) {
                const question = match[1].trim();
                const questionLineNumber = i + 1;
                const answerLines: string[] = [];
                let ankiId: number | null = null;

                i++;
                while (i < lines.length) {
                    const answerLine = lines[i] ?? "";
                    const idMatch = answerLine.match(/^ID:\s*(\d+)/);

                    if (idMatch?.[1]) {
                        ankiId = parseInt(idMatch[1], 10);
                        i++;
                        continue;
                    }

                    if (answerLine.trim() === "" || this.isFlashcardLine(answerLine)) {
                        i--;
                        break;
                    }

                    answerLines.push(answerLine);
                    i++;
                }

                const answer = answerLines.join("\n").trim();
                if (question) {
                    flashcards.push({ question, answer, ankiId, lineNumber: questionLineNumber });
                }
            }
        }

        return flashcards;
    }

    private isFlashcardLine(line: string): boolean {
        return new RegExp(`^.+?\\s*${FLASHCARD_CONFIG.tag}\\s*$`).test(line);
    }

    private async ensureFolderExists(): Promise<void> {
        const folderPath = normalizePath(this.settings.flashcardsFolder);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);

        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    private generateSourceContentBlock(noteContent: string): string {
        return `\n${FLASHCARD_CONFIG.sourceContentStartMarker}\n${noteContent}\n${FLASHCARD_CONFIG.sourceContentEndMarker}\n`;
    }

    private generateFrontmatter(sourceFile: TFile): string {
        return `---
source_link: "[[${sourceFile.basename}]]"
tags: [flashcards/auto]
---

# Flashcards for [[${sourceFile.basename}]]

`;
    }

    private getLeafForFile(file: TFile): WorkspaceLeaf {
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            const view = leaf.view as { file?: TFile };
            if (view.file?.path === file.path) {
                return leaf;
            }
        }
        return this.app.workspace.getLeaf("tab");
    }

    private processDeletedChanges(lines: string[], changes: FlashcardChange[]): string[] {
        const deletedChanges = changes
            .filter((c) => c.type === "DELETED" && c.accepted && c.originalLineNumber)
            .sort((a, b) => (b.originalLineNumber ?? 0) - (a.originalLineNumber ?? 0));

        for (const change of deletedChanges) {
            const lineIndex = (change.originalLineNumber ?? 0) - 1;
            if (lineIndex < 0 || lineIndex >= lines.length) continue;

            let endIndex = lineIndex + 1;
            while (endIndex < lines.length) {
                const line = lines[endIndex] ?? "";
                if (line.trim() === "" || this.isFlashcardLine(line)) {
                    break;
                }
                endIndex++;
            }

            if (endIndex < lines.length && (lines[endIndex] ?? "").trim() === "") {
                endIndex++;
            }

            lines.splice(lineIndex, endIndex - lineIndex);
        }

        return lines;
    }

    private processModifiedChanges(lines: string[], changes: FlashcardChange[]): string[] {
        const modifiedChanges = changes
            .filter((c) => c.type === "MODIFIED" && c.accepted && c.originalLineNumber)
            .sort((a, b) => (b.originalLineNumber ?? 0) - (a.originalLineNumber ?? 0));

        for (const change of modifiedChanges) {
            const lineIndex = (change.originalLineNumber ?? 0) - 1;
            if (lineIndex < 0 || lineIndex >= lines.length) continue;

            let endIndex = lineIndex + 1;
            while (endIndex < lines.length) {
                const line = lines[endIndex] ?? "";
                if (line.trim() === "" || this.isFlashcardLine(line)) {
                    break;
                }
                endIndex++;
            }

            const newFlashcardLines = [
                `${change.question} ${FLASHCARD_CONFIG.tag}`,
                change.answer,
            ];

            lines.splice(lineIndex, endIndex - lineIndex, ...newFlashcardLines);
        }

        return lines;
    }

    private processNewChanges(lines: string[], changes: FlashcardChange[]): string[] {
        const newChanges = changes.filter((c) => c.type === "NEW" && c.accepted);

        if (newChanges.length > 0) {
            const lastLine = lines[lines.length - 1] ?? "";
            if (lastLine.trim() !== "") {
                lines.push("");
            }

            for (const change of newChanges) {
                lines.push(`${change.question} ${FLASHCARD_CONFIG.tag}`);
                lines.push(change.answer);
                lines.push("");
            }
        }

        return lines;
    }
}
