/**
 * Flashcard Manager Service
 * Handles flashcard file operations in the Obsidian vault
 */
import { App, TFile, normalizePath, WorkspaceLeaf } from "obsidian";
import { FLASHCARD_CONFIG } from "../constants";
import { type FlashcardItem, type FlashcardChange } from "../validation";
import { FileError } from "../errors";
import type { ShadowAnkiSettings, FSRSCardData, FSRSFlashcardItem } from "../types";
import { createDefaultFSRSData } from "../types";

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

                i++;
                while (i < lines.length) {
                    const answerLine = lines[i] ?? "";

                    // Skip legacy ID lines
                    if (/^ID:\s*\d+/.test(answerLine)) {
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
                    flashcards.push({ question, answer, lineNumber: questionLineNumber });
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

    // ===== FSRS Methods =====

    /**
     * Get all flashcards with FSRS data from all flashcard files
     */
    async getAllFSRSCards(): Promise<FSRSFlashcardItem[]> {
        const allCards: FSRSFlashcardItem[] = [];
        const folderPath = normalizePath(this.settings.flashcardsFolder);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);

        if (!folder) {
            return allCards;
        }

        // Get all markdown files in the flashcards folder
        const files = this.app.vault.getMarkdownFiles().filter(
            (file) => file.path.startsWith(folderPath + "/") &&
                      file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
        );

        for (const file of files) {
            const cards = await this.extractFSRSCards(file);
            allCards.push(...cards);
        }

        return allCards;
    }

    /**
     * Extract flashcards with FSRS data from a single file
     */
    async extractFSRSCards(file: TFile): Promise<FSRSFlashcardItem[]> {
        const content = await this.app.vault.read(file);
        return this.parseFSRSFlashcards(content, file.path);
    }

    /**
     * Parse flashcard content and extract FSRS data
     */
    private parseFSRSFlashcards(content: string, filePath: string): FSRSFlashcardItem[] {
        const flashcards: FSRSFlashcardItem[] = [];
        const lines = content.split("\n");
        const flashcardPattern = new RegExp(`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`);
        const fsrsPattern = new RegExp(
            `${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
        );

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            const match = line.match(flashcardPattern);

            if (match?.[1]) {
                const question = match[1].trim();
                const questionLineNumber = i + 1;
                const answerLines: string[] = [];
                let fsrsData: FSRSCardData | null = null;

                i++;
                while (i < lines.length) {
                    const answerLine = lines[i] ?? "";

                    // Check for FSRS data comment
                    const fsrsMatch = answerLine.match(fsrsPattern);
                    if (fsrsMatch?.[1]) {
                        try {
                            fsrsData = JSON.parse(fsrsMatch[1]) as FSRSCardData;
                        } catch {
                            // Invalid JSON, skip
                        }
                        i++;
                        continue;
                    }

                    // Skip ID: lines (legacy)
                    if (answerLine.match(/^ID:\s*\d+/)) {
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
                    // Generate FSRS data if not present
                    if (!fsrsData) {
                        fsrsData = createDefaultFSRSData(this.generateCardId());
                    }

                    flashcards.push({
                        id: fsrsData.id,
                        question,
                        answer,
                        lineNumber: questionLineNumber,
                        filePath,
                        fsrs: fsrsData,
                    });
                }
            }
        }

        return flashcards;
    }

    /**
     * Update FSRS data for a specific card in a file
     */
    async updateCardFSRS(
        filePath: string,
        cardId: string,
        newFSRSData: FSRSCardData,
        lineNumber: number
    ): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            throw new FileError("Flashcard file not found", filePath, "read");
        }

        const content = await this.app.vault.read(file);
        const lines = content.split("\n");
        const flashcardPattern = new RegExp(`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`);
        const fsrsPattern = new RegExp(
            `${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
        );

        let modified = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            const match = line.match(flashcardPattern);

            if (match) {
                // Found a flashcard, look for FSRS data in next lines
                let foundFsrs = false;
                let fsrsLineIndex = -1;

                for (let j = i + 1; j < lines.length; j++) {
                    const checkLine = lines[j] ?? "";
                    if (checkLine.trim() === "" || this.isFlashcardLine(checkLine)) {
                        break;
                    }

                    const fsrsMatch = checkLine.match(fsrsPattern);
                    if (fsrsMatch?.[1]) {
                        try {
                            const existingData = JSON.parse(fsrsMatch[1]) as FSRSCardData;
                            if (existingData.id === cardId) {
                                foundFsrs = true;
                                fsrsLineIndex = j;
                                break;
                            }
                        } catch {
                            // Invalid JSON
                        }
                    }
                }

                if (foundFsrs && fsrsLineIndex >= 0) {
                    // Update existing FSRS line
                    lines[fsrsLineIndex] = this.serializeFSRSData(newFSRSData);
                    modified = true;
                    break;
                } else if (i === lineNumber - 1) {
                    // Card without FSRS - insert new FSRS data after answer
                    let insertIndex = i + 1;
                    while (insertIndex < lines.length) {
                        const checkLine = lines[insertIndex] ?? "";
                        if (checkLine.trim() === "" || this.isFlashcardLine(checkLine)) {
                            break;
                        }
                        insertIndex++;
                    }
                    lines.splice(insertIndex, 0, this.serializeFSRSData(newFSRSData));
                    modified = true;
                    break;
                }
            }
        }

        if (modified) {
            const newContent = lines.join("\n");
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Migrate all existing flashcards to include FSRS data
     */
    async migrateToFSRS(): Promise<{ migrated: number; total: number }> {
        const folderPath = normalizePath(this.settings.flashcardsFolder);
        const files = this.app.vault.getMarkdownFiles().filter(
            (file) => file.path.startsWith(folderPath + "/") &&
                      file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
        );

        let migrated = 0;
        let total = 0;

        for (const file of files) {
            const result = await this.migrateFileFSRS(file);
            migrated += result.migrated;
            total += result.total;
        }

        return { migrated, total };
    }

    /**
     * Migrate a single file to FSRS format
     */
    private async migrateFileFSRS(file: TFile): Promise<{ migrated: number; total: number }> {
        const content = await this.app.vault.read(file);
        const lines = content.split("\n");
        const flashcardPattern = new RegExp(`^(.+?)\\s*${FLASHCARD_CONFIG.tag}\\s*$`);
        const fsrsPattern = new RegExp(
            `${FLASHCARD_CONFIG.fsrsDataPrefix}(.+?)${FLASHCARD_CONFIG.fsrsDataSuffix}`
        );

        let migrated = 0;
        let total = 0;
        const insertions: { index: number; line: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            const match = line.match(flashcardPattern);

            if (match) {
                total++;

                // Check if this card already has FSRS data
                let hasFsrs = false;
                let endOfCard = i + 1;

                for (let j = i + 1; j < lines.length; j++) {
                    const checkLine = lines[j] ?? "";
                    if (checkLine.trim() === "" || this.isFlashcardLine(checkLine)) {
                        endOfCard = j;
                        break;
                    }
                    if (checkLine.match(fsrsPattern)) {
                        hasFsrs = true;
                        break;
                    }
                    endOfCard = j + 1;
                }

                if (!hasFsrs) {
                    // Need to add FSRS data
                    const fsrsData = createDefaultFSRSData(this.generateCardId());
                    insertions.push({
                        index: endOfCard,
                        line: this.serializeFSRSData(fsrsData),
                    });
                    migrated++;
                }
            }
        }

        // Apply insertions in reverse order to preserve indices
        insertions.sort((a, b) => b.index - a.index);
        for (const insertion of insertions) {
            lines.splice(insertion.index, 0, insertion.line);
        }

        if (migrated > 0) {
            const newContent = lines.join("\n");
            await this.app.vault.modify(file, newContent);
        }

        return { migrated, total };
    }

    /**
     * Serialize FSRS data to comment format
     */
    private serializeFSRSData(data: FSRSCardData): string {
        return `${FLASHCARD_CONFIG.fsrsDataPrefix}${JSON.stringify(data)}${FLASHCARD_CONFIG.fsrsDataSuffix}`;
    }

    /**
     * Generate unique card ID
     */
    private generateCardId(): string {
        return crypto.randomUUID();
    }

    /**
     * Remove all FSRS data from all flashcard files (for testing)
     */
    async removeAllFSRSData(): Promise<{ filesModified: number; entriesRemoved: number }> {
        const folderPath = normalizePath(this.settings.flashcardsFolder);
        const files = this.app.vault.getMarkdownFiles().filter(
            (file) => file.path.startsWith(folderPath + "/") &&
                      file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
        );

        let filesModified = 0;
        let entriesRemoved = 0;
        const fsrsPattern = /<!--fsrs:\{.*?\}-->\n?/g;

        for (const file of files) {
            const content = await this.app.vault.read(file);
            const matches = content.match(fsrsPattern);
            if (matches && matches.length > 0) {
                const newContent = content.replace(fsrsPattern, "");
                await this.app.vault.modify(file, newContent);
                filesModified++;
                entriesRemoved += matches.length;
            }
        }

        return { filesModified, entriesRemoved };
    }

    /**
     * Remove all legacy Anki IDs from flashcard files
     */
    async removeAllLegacyIds(): Promise<{ filesModified: number; idsRemoved: number }> {
        const folderPath = normalizePath(this.settings.flashcardsFolder);
        const files = this.app.vault.getMarkdownFiles().filter(
            (file) => file.path.startsWith(folderPath + "/") &&
                      file.name.startsWith(FLASHCARD_CONFIG.filePrefix)
        );

        let filesModified = 0;
        let idsRemoved = 0;
        const idPattern = /^ID:\s*\d+\n?/gm;

        for (const file of files) {
            const content = await this.app.vault.read(file);
            const matches = content.match(idPattern);
            if (matches && matches.length > 0) {
                const newContent = content.replace(idPattern, "");
                await this.app.vault.modify(file, newContent);
                filesModified++;
                idsRemoved += matches.length;
            }
        }

        return { filesModified, idsRemoved };
    }
}
