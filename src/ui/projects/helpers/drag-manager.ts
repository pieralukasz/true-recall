import Sortable from "sortablejs";
import { showNoteDropMenu, type NoteDropAction } from "./note-drop-menu";

export interface ProjectDragCallbacks {
	onReorderProjects: (newOrder: string[]) => void;
	onNoteDrop: (
		notePath: string,
		noteName: string,
		sourceProjectName: string | null,
		targetProjectName: string,
		action: NoteDropAction
	) => void;
}

export interface DragManagerResult {
	projectSortable: Sortable;
	destroyAll: () => void;
	initNotesListSortable: (
		container: HTMLElement,
		projectName: string
	) => Sortable;
}

let lastDropPosition = { x: 0, y: 0 };

function trackMousePosition(e: MouseEvent): void {
	lastDropPosition = { x: e.clientX, y: e.clientY };
}

function trackTouchPosition(e: TouchEvent): void {
	const touch = e.touches[0] ?? e.changedTouches[0];
	if (touch) {
		lastDropPosition = { x: touch.clientX, y: touch.clientY };
	}
}

interface ActiveDrag {
	notePath: string;
	noteName: string;
	sourceProject: string | null;
}

export function initDragManager(
	projectListEl: HTMLElement,
	callbacks: ProjectDragCallbacks
): DragManagerResult {
	const noteSortables: Sortable[] = [];
	let activeDrag: ActiveDrag | null = null;

	// Track pointer for drop menu position
	document.addEventListener("mousemove", trackMousePosition);
	document.addEventListener("touchmove", trackTouchPosition, { passive: true });

	// Project reordering
	const projectSortable = Sortable.create(projectListEl, {
		animation: 150,
		handle: ".ep-drag-handle",
		ghostClass: "ep-drag-ghost",
		dragClass: "ep-drag-active",
		delay: 200,
		delayOnTouchOnly: true,
		touchStartThreshold: 5,
		filter: ".ep-no-drag",
		onEnd: () => {
			const children = Array.from(projectListEl.children);
			const order = children
				.map((el) => (el as HTMLElement).getAttribute("data-project-id"))
				.filter((id): id is string => id != null);
			callbacks.onReorderProjects(order);
		},
	});

	function handleNoteDrop(
		notePath: string,
		noteName: string,
		sourceProject: string | null,
		targetProject: string
	): void {
		void showNoteDropMenu(lastDropPosition, {
			noteName,
			targetProjectName: targetProject,
			sourceProjectName: sourceProject,
		}).then((action) => {
			callbacks.onNoteDrop(
				notePath,
				noteName,
				sourceProject,
				targetProject,
				action
			);
		});
	}

	function initNotesListSortable(
		container: HTMLElement,
		projectName: string
	): Sortable {
		const sortable = Sortable.create(container, {
			group: { name: "notes", pull: true, put: true },
			animation: 150,
			handle: ".ep-note-drag-handle",
			ghostClass: "ep-drag-ghost",
			dragClass: "ep-drag-active",
			delay: 200,
			delayOnTouchOnly: true,
			touchStartThreshold: 5,
			onStart: (evt) => {
				const notePath = evt.item?.getAttribute("data-note-path") ?? "";
				const noteName = evt.item?.getAttribute("data-note-name") ?? "";
				activeDrag = {
					notePath,
					noteName,
					sourceProject: container.getAttribute("data-project-name"),
				};
				projectListEl.classList.add("ep-note-dragging");
			},
			onEnd: (evt) => {
				projectListEl.classList.remove("ep-note-dragging");

				const fromEl = evt.from;
				const toEl = evt.to;

				if (fromEl !== toEl) {
					// Cross-container drop (note landed in another project's notes list)
					const notePath = evt.item?.getAttribute("data-note-path") ?? "";
					const noteName = evt.item?.getAttribute("data-note-name") ?? "";
					const sourceProject = fromEl.getAttribute("data-project-name");
					const targetProject = toEl.getAttribute("data-project-name");

					if (targetProject && notePath) {
						handleNoteDrop(notePath, noteName, sourceProject, targetProject);
					}
				} else if (activeDrag) {
					// Item reverted — check if cursor is over a project header
					const el = document.elementFromPoint(
						lastDropPosition.x,
						lastDropPosition.y
					);
					const targetRow = el?.closest(".ep-project-row");
					if (targetRow) {
						const targetProjectId = targetRow
							.closest("[data-project-id]")
							?.getAttribute("data-project-id");
						if (
							targetProjectId &&
							targetProjectId !== activeDrag.sourceProject
						) {
							handleNoteDrop(
								activeDrag.notePath,
								activeDrag.noteName,
								activeDrag.sourceProject,
								targetProjectId
							);
						}
					}
				}

				activeDrag = null;
			},
		});
		noteSortables.push(sortable);
		return sortable;
	}

	function destroyAll(): void {
		document.removeEventListener("mousemove", trackMousePosition);
		document.removeEventListener("touchmove", trackTouchPosition);
		projectSortable.destroy();
		for (const s of noteSortables) {
			s.destroy();
		}
		noteSortables.length = 0;
	}

	return { projectSortable, destroyAll, initNotesListSortable };
}
