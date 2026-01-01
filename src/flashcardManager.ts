import { App, TFile, normalizePath } from "obsidian";
import { ShadowAnkiSettings } from "./settings";

// Single flashcard with question and answer
export interface FlashcardItem {
    question: string;
    answer: string;
    ankiId: number | null; // ID from Anki (from ID: line)
    lineNumber: number; // Line number in the flashcard file (for editing)
}

// Flashcard file data structure
export interface FlashcardInfo {
    exists: boolean;
    filePath: string;
    cardCount: number;
    questions: string[]; // Keep for backwards compatibility (blocklist)
    flashcards: FlashcardItem[]; // Full Q&A pairs
    lastModified: number | null;
}

export class FlashcardManager {
    private app: App;
    private settings: ShadowAnkiSettings;

    constructor(app: App, settings: ShadowAnkiSettings) {
        this.app = app;
        this.settings = settings;
    }

    // Update settings reference
    updateSettings(settings: ShadowAnkiSettings): void {
        this.settings = settings;
    }

    // Get the flashcard file path for a source note
    getFlashcardPath(sourceFile: TFile): string {
        const baseName = sourceFile.basename;
        return normalizePath(`${this.settings.flashcardsFolder}/flashcards_${baseName}.md`);
    }

    // Get flashcard file info for a source note
    async getFlashcardInfo(sourceFile: TFile): Promise<FlashcardInfo> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            return {
                exists: false,
                filePath: flashcardPath,
                cardCount: 0,
                questions: [],
                flashcards: [],
                lastModified: null
            };
        }

        const content = await this.app.vault.read(flashcardFile);
        const flashcards = this.extractFlashcards(content);
        const questions = flashcards.map(f => f.question);

        return {
            exists: true,
            filePath: flashcardPath,
            cardCount: flashcards.length,
            questions: questions,
            flashcards: flashcards,
            lastModified: flashcardFile.stat.mtime
        };
    }

    // Get flashcard info directly from a flashcard file (when viewing the file itself)
    async getFlashcardInfoDirect(flashcardFile: TFile): Promise<FlashcardInfo> {
        const content = await this.app.vault.read(flashcardFile);
        const flashcards = this.extractFlashcards(content);
        const questions = flashcards.map(f => f.question);

        return {
            exists: true,
            filePath: flashcardFile.path,
            cardCount: flashcards.length,
            questions: questions,
            flashcards: flashcards,
            lastModified: flashcardFile.stat.mtime
        };
    }

    // Extract flashcards with questions and answers
    private extractFlashcards(content: string): FlashcardItem[] {
        const flashcards: FlashcardItem[] = [];
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            // Match lines ending with #flashcard
            const match = line.match(/^(.+?)\s*#flashcard\s*$/);
            if (match?.[1]) {
                const question = match[1].trim();
                const questionLineNumber = i + 1; // 1-based line number
                // Collect answer lines until empty line or next #flashcard or ID: line
                const answerLines: string[] = [];
                let ankiId: number | null = null;
                i++;
                while (i < lines.length) {
                    const answerLine = lines[i] ?? "";
                    // Check for ID line
                    const idMatch = answerLine.match(/^ID:\s*(\d+)/);
                    if (idMatch?.[1]) {
                        ankiId = parseInt(idMatch[1], 10);
                        i++;
                        continue;
                    }
                    // Stop at empty line or next flashcard
                    if (answerLine.trim() === "" ||
                        answerLine.match(/^.+?\s*#flashcard\s*$/)) {
                        i--; // Back up so outer loop doesn't skip this line
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

    // Ensure the flashcards folder exists
    private async ensureFolderExists(): Promise<void> {
        const folderPath = normalizePath(this.settings.flashcardsFolder);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);

        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    // Generate frontmatter for a new flashcard file
    private generateFrontmatter(sourceFile: TFile): string {
        return `---
source_link: "[[${sourceFile.basename}]]"
tags: [flashcards/auto]
---

# Flashcards for [[${sourceFile.basename}]]

`;
    }

    // Create a new flashcard file
    async createFlashcardFile(
        sourceFile: TFile,
        flashcardContent: string
    ): Promise<TFile> {
        await this.ensureFolderExists();

        const flashcardPath = this.getFlashcardPath(sourceFile);
        const frontmatter = this.generateFrontmatter(sourceFile);
        const fullContent = frontmatter + flashcardContent;

        // Check if file already exists
        const existing = this.app.vault.getAbstractFileByPath(flashcardPath);
        if (existing instanceof TFile) {
            // Overwrite existing file
            await this.app.vault.modify(existing, fullContent);
            return existing;
        }

        // Create new file
        return await this.app.vault.create(flashcardPath, fullContent);
    }

    // Append new flashcards to existing file
    async appendFlashcards(
        sourceFile: TFile,
        newFlashcardContent: string
    ): Promise<TFile> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (!(flashcardFile instanceof TFile)) {
            // File doesn't exist, create it
            return await this.createFlashcardFile(sourceFile, newFlashcardContent);
        }

        // Read existing content and append
        const existingContent = await this.app.vault.read(flashcardFile);
        const updatedContent = existingContent.trimEnd() + "\n\n" + newFlashcardContent;
        await this.app.vault.modify(flashcardFile, updatedContent);

        return flashcardFile;
    }

    // Open flashcard file in a new tab
    async openFlashcardFile(sourceFile: TFile): Promise<void> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (flashcardFile instanceof TFile) {
            await this.app.workspace.getLeaf("tab").openFile(flashcardFile);
        }
    }

    // Open flashcard file at a specific line for editing
    async openFlashcardFileAtLine(sourceFile: TFile, lineNumber: number): Promise<void> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (flashcardFile instanceof TFile) {
            await this.openFileAtLine(flashcardFile, lineNumber);
        }
    }

    // Open any file at a specific line (used when viewing flashcard file directly)
    async openFileAtLine(file: TFile, lineNumber: number): Promise<void> {
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(file);
        // Set cursor to the specific line
        const view = leaf.view;
        if (view && "editor" in view) {
            const editor = (view as { editor: { setCursor: (pos: { line: number; ch: number }) => void } }).editor;
            editor.setCursor({ line: lineNumber - 1, ch: 0 });
        }
    }

    // Remove a flashcard from the file by its line number
    async removeFlashcard(sourceFile: TFile, lineNumber: number): Promise<boolean> {
        const flashcardPath = this.getFlashcardPath(sourceFile);
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);
        if (!(flashcardFile instanceof TFile)) {
            return false;
        }
        return this.removeFlashcardDirect(flashcardFile, lineNumber);
    }

    // Remove a flashcard directly from a flashcard file
    async removeFlashcardDirect(flashcardFile: TFile, lineNumber: number): Promise<boolean> {

        if (!(flashcardFile instanceof TFile)) {
            return false;
        }

        const content = await this.app.vault.read(flashcardFile);
        const lines = content.split("\n");

        // Find the flashcard block starting at lineNumber (1-based)
        const startIndex = lineNumber - 1;
        if (startIndex < 0 || startIndex >= lines.length) {
            return false;
        }

        // Find the end of this flashcard block
        let endIndex = startIndex + 1;
        while (endIndex < lines.length) {
            const line = lines[endIndex] ?? "";
            // Stop at empty line or next flashcard
            if (line.trim() === "" || line.match(/^.+?\s*#flashcard\s*$/)) {
                break;
            }
            endIndex++;
        }

        // Also remove trailing empty lines
        while (endIndex < lines.length && (lines[endIndex] ?? "").trim() === "") {
            endIndex++;
        }

        // Remove the flashcard block
        lines.splice(startIndex, endIndex - startIndex);

        // Update the file
        const newContent = lines.join("\n");
        await this.app.vault.modify(flashcardFile, newContent);

        return true;
    }
}
