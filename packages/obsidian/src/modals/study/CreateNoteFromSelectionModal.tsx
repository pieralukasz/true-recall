import { type App, normalizePath, TFolder } from "obsidian";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { HierarchyTreeNode } from "@true-recall/core/services/notes/hierarchy.service";

import { Clickable, SearchInput } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";

import type TrueRecallPlugin from "../../main";

export interface CreateNoteFromSelectionResult {
	cancelled: boolean;
	name: string;
	folder: string;
	parentProject: string | null;
}

function flattenProjects(nodes: HierarchyTreeNode[]): HierarchyTreeNode[] {
	const result: HierarchyTreeNode[] = [];
	const walk = (list: HierarchyTreeNode[]) => {
		for (const n of list) {
			result.push(n);
			walk(n.children);
		}
	};
	walk(nodes);
	return result;
}

function Body({
	defaultName,
	folders,
	projects,
	onResolve,
}: {
	defaultName: string;
	folders: string[];
	projects: HierarchyTreeNode[];
	onResolve: (result: CreateNoteFromSelectionResult) => void;
}) {
	const [name, setName] = useState(defaultName);
	const [folder, setFolder] = useState("");
	const [folderSearch, setFolderSearch] = useState("");
	const [projectSearch, setProjectSearch] = useState("");
	const [selectedProject, setSelectedProject] = useState<string | null>(null);
	const [showFolders, setShowFolders] = useState(false);
	const [showProjects, setShowProjects] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => {
			nameRef.current?.focus();
			nameRef.current?.select();
		}, 50);
		return () => clearTimeout(id);
	}, []);

	const filteredFolders = useMemo(() => {
		if (!folderSearch) return folders;
		const q = folderSearch.toLowerCase();
		return folders.filter((f) => f.toLowerCase().includes(q));
	}, [folders, folderSearch]);

	const filteredProjects = useMemo(() => {
		if (!projectSearch) return projects;
		const q = projectSearch.toLowerCase();
		return projects.filter((p) => p.name.toLowerCase().includes(q));
	}, [projects, projectSearch]);

	const trimmed = name.trim();
	const canCreate = trimmed.length > 0;

	const handleCreate = () => {
		if (!canCreate) return;
		onResolve({
			cancelled: false,
			name: trimmed,
			folder,
			parentProject: selectedProject,
		});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<div>
				<div class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
					Note name
				</div>
				<input
					ref={nameRef}
					type="text"
					placeholder="Note name"
					class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
					value={name}
					onInput={(e) => setName((e.target as HTMLInputElement).value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !showFolders && !showProjects)
							handleCreate();
					}}
				/>
			</div>

			<div>
				<Clickable
					class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small ep:text-obs-muted ep:hover:text-obs-normal"
					onClick={() => setShowFolders(!showFolders)}
				>
					<span>{showFolders ? "▾" : "▸"}</span>
					<span>Folder{folder ? `: ${folder}` : " (vault root)"}</span>
				</Clickable>
				{showFolders && (
					<div class="ep:mt-1">
						<SearchInput
							placeholder="Filter folders..."
							ariaLabel="Filter folders"
							class="ep:mb-1"
							value={folderSearch}
							onChange={setFolderSearch}
						/>
						<div
							class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto"
							style="max-height: 150px"
						>
							<Clickable
								class={`ep:w-full ep:flex ep:items-center ep:p-2 ep:text-ui-small ep:border-b ep:border-obs-border ep:transition-colors ${
									folder === ""
										? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
										: "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"
								}`}
								onClick={() => {
									setFolder("");
									setShowFolders(false);
								}}
								stopPropagation={false}
							>
								/ (vault root)
							</Clickable>
							{filteredFolders.map((f) => (
								<Clickable
									key={f}
									class={`ep:w-full ep:flex ep:items-center ep:p-2 ep:text-ui-small ep:border-b ep:border-obs-border ep:last:border-b-0 ep:transition-colors ${
										folder === f
											? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
											: "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"
									}`}
									onClick={() => {
										setFolder(f);
										setShowFolders(false);
									}}
									stopPropagation={false}
								>
									{f}
								</Clickable>
							))}
						</div>
					</div>
				)}
			</div>

			{projects.length > 0 && (
				<div>
					<Clickable
						class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small ep:text-obs-muted ep:hover:text-obs-normal"
						onClick={() => setShowProjects(!showProjects)}
					>
						<span>{showProjects ? "▾" : "▸"}</span>
						<span>
							{selectedProject
								? `Project: ${selectedProject}`
								: "Add to project (optional)"}
						</span>
					</Clickable>
					{showProjects && (
						<div class="ep:mt-1">
							<SearchInput
								placeholder="Filter projects..."
								ariaLabel="Filter projects"
								class="ep:mb-1"
								value={projectSearch}
								onChange={setProjectSearch}
							/>
							<div
								class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto"
								style="max-height: 150px"
							>
								<Clickable
									class={`ep:w-full ep:flex ep:items-center ep:p-2 ep:text-ui-small ep:border-b ep:border-obs-border ep:transition-colors ${
										selectedProject === null
											? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
											: "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"
									}`}
									onClick={() => {
										setSelectedProject(null);
										setShowProjects(false);
									}}
									stopPropagation={false}
								>
									None
								</Clickable>
								{filteredProjects.map((p) => (
									<Clickable
										key={p.path}
										class={`ep:w-full ep:flex ep:items-center ep:p-2 ep:text-ui-small ep:border-b ep:border-obs-border ep:last:border-b-0 ep:transition-colors ${
											selectedProject === p.name
												? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
												: "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"
										}`}
										onClick={() => {
											setSelectedProject(p.name);
											setShowProjects(false);
										}}
										stopPropagation={false}
									>
										{p.name}
									</Clickable>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			<div class="ep:flex ep:justify-end ep:mt-1">
				<Clickable
					class="mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small"
					onClick={handleCreate}
					disabled={!canCreate}
				>
					Create note
				</Clickable>
			</div>
		</div>
	);
}

export class CreateNoteFromSelectionModal extends BasePromiseModal<CreateNoteFromSelectionResult> {
	private folders: string[] = [];
	private projects: HierarchyTreeNode[] = [];

	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private defaultName: string,
	) {
		super(app, {
			title: "Create note from selection",
			width: "450px",
		});
	}

	protected getDefaultResult(): CreateNoteFromSelectionResult {
		return { cancelled: true, name: "", folder: "", parentProject: null };
	}

	onOpen(): void {
		super.onOpen();
		this.folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path !== "/")
			.map((f) => f.path)
			.sort((a, b) => a.localeCompare(b));

		const hierarchy = this.plugin.hierarchyService.buildHierarchy();
		this.projects = flattenProjects(hierarchy);
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<Body
				defaultName={this.defaultName}
				folders={this.folders}
				projects={this.projects}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}

	static buildNotePath(name: string, folder: string): string {
		const raw = folder ? `${folder}/${name}.md` : `${name}.md`;
		return normalizePath(raw);
	}
}
