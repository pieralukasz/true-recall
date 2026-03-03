import type { ParsedCard } from "@features/study/services/flashcard/bulk-card-parser";
import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/modals/simple-editor/NotePickerCombobox";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import { cn } from "@shared/ui/utils";
import { useCallback, useMemo, useState } from "preact/hooks";
import { Notice, TFile } from "obsidian";
import { QuickTab } from "./QuickTab";
import { StructuredTab } from "./StructuredTab";
import {
	type AddFlashcardsTab,
	loadAddModalPrefs,
	saveAddModalPrefs,
} from "./types";

const TABS: { id: AddFlashcardsTab; label: string }[] = [
	{ id: "quick", label: "Quick" },
	{ id: "structured", label: "Structured" },
];

interface AddFlashcardsAppProps {
	onClose: () => void;
	/** Pre-select note type (e.g. from current review card) */
	defaultNoteTypeId?: string;
}

export function AddFlashcardsApp({
	onClose,
	defaultNoteTypeId,
}: AddFlashcardsAppProps) {
	const app = useApp();
	const plugin = usePlugin();
	const prefs = loadAddModalPrefs();

	const [activeTab, setActiveTab] = useState<AddFlashcardsTab>(
		prefs.activeTab,
	);
	const [sessionCount, setSessionCount] = useState(0);

	// Source note state — restored from last session
	const initialSourceNote = useMemo(() => {
		if (!prefs.lastSourceNotePath) return null;
		const file = app.vault.getAbstractFileByPath(prefs.lastSourceNotePath);
		return file instanceof TFile ? file : null;
	}, [app, prefs.lastSourceNotePath]);

	const [selectedSourceNote, setSelectedSourceNote] = useState<TFile | null>(
		initialSourceNote,
	);

	const handleSourceNoteChange = useCallback((note: TFile | null) => {
		setSelectedSourceNote(note);
		saveAddModalPrefs({ lastSourceNotePath: note?.path ?? "" });
	}, []);

	const quickNoteTypeId = defaultNoteTypeId ?? prefs.lastQuickNoteTypeId;
	const structuredNoteTypeId = defaultNoteTypeId ?? prefs.lastNoteTypeId;

	const handleTabChange = useCallback((tab: AddFlashcardsTab) => {
		setActiveTab(tab);
		saveAddModalPrefs({ activeTab: tab });
	}, []);

	const resolveSourceUid = useCallback(async (): Promise<string | undefined> => {
		if (!selectedSourceNote || !plugin.flashcardManager) return undefined;
		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote, uid);
		}
		return uid;
	}, [selectedSourceNote, plugin.flashcardManager]);

	const handleQuickSave = useCallback(
		async (cards: ParsedCard[]) => {
			if (!plugin.flashcardManager?.hasStore()) {
				new Notice("Database not initialized");
				return;
			}

			const sourceUid = await resolveSourceUid();

			const result = plugin.flashcardManager.createNoteBatch(
				cards.map((c) => ({
					noteTypeId: c.noteTypeId,
					fields: c.fields,
					sourceUid,
					createdVia: "manual",
				})),
			);

			const totalCards = result.cards.length;
			setSessionCount((prev) => prev + totalCards);
			new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);
		},
		[plugin.flashcardManager, resolveSourceUid],
	);

	const handleStructuredSave = useCallback(
		async (noteTypeId: string, fields: Record<string, string>) => {
			if (!plugin.flashcardManager?.hasStore()) {
				new Notice("Database not initialized");
				return;
			}

			const sourceUid = await resolveSourceUid();

			const result = plugin.flashcardManager.createNote({
				noteTypeId,
				fields,
				sourceUid,
				createdVia: "manual",
			});

			const totalCards = result.cards.length;
			setSessionCount((prev) => prev + totalCards);
			new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);
		},
		[plugin.flashcardManager, resolveSourceUid],
	);

	const handleQuickNoteTypeChange = useCallback((id: string) => {
		saveAddModalPrefs({ lastQuickNoteTypeId: id });
	}, []);

	const handleStructuredNoteTypeChange = useCallback((id: string) => {
		saveAddModalPrefs({ lastNoteTypeId: id });
	}, []);

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Tabs */}
			<div class="ep:border-b ep:border-obs-border">
				<div class="ep:flex ep:gap-6" role="tablist">
					{TABS.map(({ id, label }) => {
						const isActive = activeTab === id;
						return (
							<Clickable
								key={id}
								role="tab"
								aria-selected={isActive}
								class={cn(
									"ep:relative ep:pb-2.5 ep:text-sm ep:transition-colors ep:duration-150",
									isActive
										? "ep:text-obs-normal ep:font-semibold"
										: "ep:text-obs-muted ep:hover:text-obs-normal",
								)}
								onClick={() => handleTabChange(id)}
							>
								{label}
								{isActive && (
									<div class="ep:absolute ep:bottom-[-1px] ep:left-0 ep:right-0 ep:h-[2px] ep:bg-obs-interactive ep:rounded-t" />
								)}
							</Clickable>
						);
					})}
				</div>
			</div>

			{/* Source note picker */}
			<div class="ep:flex ep:items-center ep:gap-3">
				<label class="ep:text-ui-smaller ep:text-obs-muted ep:shrink-0">
					Source note:
				</label>
				<div class="ep:flex-1">
					<NotePickerCombobox
						app={app}
						selectedNote={selectedSourceNote}
						onSelect={handleSourceNoteChange}
					/>
				</div>
				{selectedSourceNote && (
					<Clickable
						class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
						onClick={() => handleSourceNoteChange(null)}
					>
						Clear
					</Clickable>
				)}
			</div>

			{/* Tab content */}
			{activeTab === "quick" && (
				<QuickTab
					defaultNoteTypeId={quickNoteTypeId}
					onNoteTypeChange={handleQuickNoteTypeChange}
					onSave={handleQuickSave}
					onClose={onClose}
					sessionCount={sessionCount}
				/>
			)}
			{activeTab === "structured" && (
				<StructuredTab
					defaultNoteTypeId={structuredNoteTypeId}
					onNoteTypeChange={handleStructuredNoteTypeChange}
					onSave={handleStructuredSave}
					onClose={onClose}
					sessionCount={sessionCount}
				/>
			)}
		</div>
	);
}
