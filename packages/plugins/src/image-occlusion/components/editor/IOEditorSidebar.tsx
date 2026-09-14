import type { IOEditorController } from "../../hooks/useIOEditorController";
import { IORegionList } from "../IORegionList";
import { IOToolsPanel } from "../IOToolsPanel";
import { IOImageSection } from "./IOImageSection";
import { IOMaskModeSection } from "./IOMaskModeSection";
import { IOSelectedRegionSection } from "./IOSelectedRegionSection";
import { IOSourceSection } from "./IOSourceSection";

interface IOEditorSidebarProps {
	editor: IOEditorController;
}

export function IOEditorSidebar({ editor }: IOEditorSidebarProps) {
	return (
		<aside class="true-recall-io-editor-right">
			<IOSourceSection source={editor.source} />
			<IOImageSection image={editor.image} />
			<IOToolsPanel
				{...editor.tools}
				onAiDetect={(hint) => void editor.tools.onAiDetect(hint)}
			/>
			<IOMaskModeSection
				maskMode={editor.maskMode}
				onChange={editor.onMaskModeChange}
			/>
			<IORegionList
				regions={editor.regions}
				selectedRegionId={editor.tools.selectedRegionId}
				onSelectRegion={editor.onSelectRegion}
				onDeleteSelected={editor.onDeleteSelectedRegion}
			/>
			{editor.selectedRegion ? (
				<IOSelectedRegionSection
					region={editor.selectedRegion}
					onChange={editor.onUpdateSelectedRegion}
				/>
			) : null}
		</aside>
	);
}
