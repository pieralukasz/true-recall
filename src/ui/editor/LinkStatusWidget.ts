import type { NoteStatusInfo } from "../../services/cache/note-status-cache.service";

export interface LinkStatusOptions {
	info: NoteStatusInfo;
	onPlay?: () => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const CIRCUMFERENCE = 100;
const RADIUS = 15.91549430918954; // circumference / (2 * PI)
const STROKE_WIDTH = 3.8;

export function createLinkStatusElement(options: LinkStatusOptions): HTMLSpanElement {
	const { info, onPlay } = options;

	const wrapper = document.createElement("span");
	wrapper.className = "true-recall-donut";
	wrapper.setAttribute(
		"aria-label",
		`Flashcards: ${info.new} new, ${info.learning} learning, ${info.dueToday} due today (${info.total} total)`,
	);
	wrapper.title = `Due: ${info.dueToday}, New: ${info.new}, Total: ${info.total}`;

	if (onPlay) {
		wrapper.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			onPlay();
		});
	}

	const duePercent = info.total > 0 ? (info.dueToday / info.total) * CIRCUMFERENCE : 0;
	const newPercent = info.total > 0 ? (info.new / info.total) * CIRCUMFERENCE : 0;
	const learningPercent = info.total > 0 ? (info.learning / info.total) * CIRCUMFERENCE : 0;

	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", "0 0 36 36");
	svg.setAttribute("class", "true-recall-donut-svg");

	// Background ring (full gray circle)
	svg.appendChild(createRing("true-recall-donut-bg"));

	// Colored segments drawn as stroke-dasharray arcs
	let offset = 0;

	if (duePercent > 0) {
		svg.appendChild(createSegment(duePercent, offset, "true-recall-donut-due"));
		offset += duePercent;
	}

	if (newPercent > 0) {
		svg.appendChild(createSegment(newPercent, offset, "true-recall-donut-new"));
		offset += newPercent;
	}

	if (learningPercent > 0) {
		svg.appendChild(createSegment(learningPercent, offset, "true-recall-donut-learning"));
	}

	// Center number: actionable cards (due + learning + new)
	const actionable = info.dueToday + info.learning + info.new;
	if (actionable > 0) {
		const text = document.createElementNS(SVG_NS, "text");
		text.setAttribute("x", "18");
		text.setAttribute("y", "18");
		text.setAttribute("class", "true-recall-donut-count");
		text.textContent = actionable > 99 ? "99+" : String(actionable);
		svg.appendChild(text);
	}

	wrapper.appendChild(svg);
	return wrapper;
}

function createRing(className: string): SVGCircleElement {
	const circle = document.createElementNS(SVG_NS, "circle");
	circle.setAttribute("cx", "18");
	circle.setAttribute("cy", "18");
	circle.setAttribute("r", String(RADIUS));
	circle.setAttribute("fill", "none");
	circle.setAttribute("stroke-width", String(STROKE_WIDTH));
	circle.setAttribute("class", className);
	return circle;
}

function createSegment(length: number, offset: number, className: string): SVGCircleElement {
	const circle = createRing(className);
	circle.setAttribute("stroke-dasharray", `${length} ${CIRCUMFERENCE - length}`);
	// 25 shifts start position to 12-o'clock
	circle.setAttribute("stroke-dashoffset", String(25 - offset));
	return circle;
}

export function infoEqual(a: NoteStatusInfo, b: NoteStatusInfo): boolean {
	return a.new === b.new && a.learning === b.learning && a.dueToday === b.dueToday && a.total === b.total;
}

export interface HeadingSummaryOptions {
	info: NoteStatusInfo;
	onClick: () => void;
}

export function createHeadingSummaryElement(options: HeadingSummaryOptions): HTMLSpanElement {
	const { info, onClick } = options;
	const dueCount = info.dueToday + info.learning;

	const wrapper = document.createElement("span");
	wrapper.className = "true-recall-heading-summary";
	wrapper.title = `Due: ${info.dueToday}, Learning: ${info.learning}, New: ${info.new}, Total: ${info.total}`;
	wrapper.setAttribute("aria-label", `Review ${dueCount} due cards in this section`);

	wrapper.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onClick();
	});

	const donutEl = createLinkStatusElement({ info });
	wrapper.appendChild(donutEl);

	const text = document.createElement("span");
	text.className = "true-recall-heading-due-text";
	text.textContent = dueCount > 0 ? `${dueCount} due` : `${info.total} cards`;
	wrapper.appendChild(text);

	return wrapper;
}

export function aggregateInfos(infos: NoteStatusInfo[]): NoteStatusInfo {
	let newCount = 0;
	let learning = 0;
	let dueToday = 0;
	let total = 0;
	for (const info of infos) {
		newCount += info.new;
		learning += info.learning;
		dueToday += info.dueToday;
		total += info.total;
	}
	return { new: newCount, learning, dueToday, total };
}
