import type { App } from "obsidian";
import { render } from "preact";
import { useState } from "preact/hooks";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";

export interface AddToProjectResult {
	cancelled: boolean;
	projects: string[];
}

export interface AddToProjectModalOptions {
	availableProjects: string[];
	currentProjects: string[];
}

function AddToProjectBody({
	availableProjects,
	initialSelected,
	onResolve,
}: {
	availableProjects: string[];
	initialSelected: string[];
	onResolve: (result: AddToProjectResult) => void;
}) {
	const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
		() => new Set(initialSelected),
	);

	const allProjects = [
		...new Set([...availableProjects, ...selectedProjects]),
	].sort((a, b) => a.localeCompare(b));

	const toggleProject = (name: string) => {
		setSelectedProjects((prev) => {
			const next = new Set(prev);
			if (next.has(name)) {
				next.delete(name);
			} else {
				next.add(name);
			}
			return next;
		});
	};

	return (
		<>
			<div
				class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto"
				style="max-height: 280px"
			>
				{allProjects.length === 0 ? (
					<div class="ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic">
						No projects available.
					</div>
				) : (
					allProjects.map((projectName) => {
						const isChecked = selectedProjects.has(projectName);
						return (
							<div
								key={projectName}
								class={`ep:flex ep:items-center ep:gap-3 ep:py-2 ep:px-3 ep:border-b ep:border-obs-border ep:transition-colors ep:last:border-b-0 ep:hover:bg-obs-secondary ${
									isChecked
										? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive ep:pl-2"
										: ""
								}`}
								role="option"
								tabIndex={0}
								aria-selected={isChecked}
								onClick={() => toggleProject(projectName)}
								onKeyDown={(e: KeyboardEvent) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										toggleProject(projectName);
									}
								}}
							>
								<input
									type="checkbox"
									class="ep:w-4 ep:h-4 ep:shrink-0 ep:cursor-pointer ep:accent-obs-interactive"
									checked={isChecked}
									onClick={(e) => e.stopPropagation()}
									onChange={() => toggleProject(projectName)}
								/>
								<span class="ep:flex-1 ep:text-ui-small ep:font-medium ep:cursor-pointer ep:text-obs-normal">
									{projectName}
								</span>
							</div>
						);
					})
				)}
			</div>

			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={() => onResolve({ cancelled: true, projects: [] })}
				>
					Cancel
				</button>
				<button
					type="button"
					class="mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all"
					onClick={() =>
						onResolve({
							cancelled: false,
							projects: [...selectedProjects],
						})
					}
				>
					Save
				</button>
			</div>
		</>
	);
}

export class AddToProjectModal extends BasePromiseModal<AddToProjectResult> {
	private options: AddToProjectModalOptions;
	private unmountBody?: () => void;

	constructor(app: App, options: AddToProjectModalOptions) {
		super(app, {
			title: "Add to Project",
			width: "400px",
		});
		this.options = options;
	}

	protected getDefaultResult(): AddToProjectResult {
		return { cancelled: true, projects: [] };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<AddToProjectBody
				availableProjects={this.options.availableProjects}
				initialSelected={this.options.currentProjects}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
