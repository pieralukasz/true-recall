import { isDesktop } from "@true-recall/obsidian/utils/platform";

import { useIOEditorController } from "../hooks/useIOEditorController";
import type { IOEditorMode, IOEditorResult } from "../types";
import { IOEditorFooter } from "./editor/IOEditorFooter";
import { IOEditorSidebar } from "./editor/IOEditorSidebar";
import { IOCanvas } from "./IOCanvas";

interface IOEditorAppProps {
	mode: IOEditorMode;
	onDone: (result: IOEditorResult) => void;
}

export function IOEditorApp({ mode, onDone }: IOEditorAppProps) {
	const editor = useIOEditorController({ mode, onDone });

	if (!isDesktop()) {
		return (
			<div class="ep:text-obs-muted ep:py-6">
				Image occlusion editor is available on desktop only.
			</div>
		);
	}

	return (
		<div class="true-recall-io-editor-modal ep:flex ep:flex-col ep:gap-3">
			<div class="true-recall-io-editor-layout">
				<main class="true-recall-io-editor-left">
					<IOCanvas {...editor.canvas} />
				</main>
				<IOEditorSidebar editor={editor} />
			</div>
			<IOEditorFooter
				isEdit={editor.isEdit}
				saving={editor.saving}
				onCancel={editor.onCancel}
				onSave={editor.onSave}
			/>
		</div>
	);
}
