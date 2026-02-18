import type { NoteStatusInfo } from "../../services/cache/note-status-cache.service";

export interface LinkStatusOptions {
	info: NoteStatusInfo;
	onPlay?: () => void;
	small?: boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const CIRCUMFERENCE = 100;
const RADIUS = 15.91549430918954; // circumference / (2 * PI)
const STROKE_WIDTH = 3.8;

export function createLinkStatusElement(options: LinkStatusOptions): HTMLSpanElement {
	const { info, onPlay } = options;

	const wrapper = document.createElement("span");
	wrapper.className = options.small ? "true-recall-donut true-recall-donut-sm" : "true-recall-donut";
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

export function createLinkTextCountElement(options: LinkStatusOptions): HTMLSpanElement {
	const { info, onPlay } = options;

	const wrapper = document.createElement("span");
	wrapper.className = "true-recall-link-count";
	wrapper.title = `Due: ${info.dueToday}, Learning: ${info.learning}, New: ${info.new}, Total: ${info.total}`;

	const parts: { count: number; label: string; cls: string }[] = [];
	if (info.new > 0) parts.push({ count: info.new, label: "new", cls: "true-recall-hcount-new" });
	if (info.learning > 0) parts.push({ count: info.learning, label: "lrn", cls: "true-recall-hcount-learning" });
	if (info.dueToday > 0) parts.push({ count: info.dueToday, label: "due", cls: "true-recall-hcount-due" });

	for (let i = 0; i < parts.length; i++) {
		if (i > 0) {
			const sep = document.createElement("span");
			sep.className = "true-recall-hcount-sep";
			sep.textContent = "\u00B7";
			wrapper.appendChild(sep);
		}
		const span = document.createElement("span");
		span.className = parts[i]!.cls;
		span.textContent = `${parts[i]!.count} ${parts[i]!.label}`;
		wrapper.appendChild(span);
	}

	const totalSpan = document.createElement("span");
	totalSpan.className = "true-recall-hcount-muted";
	totalSpan.textContent = parts.length > 0 ? `(${info.total})` : `(${info.total} cards)`;
	wrapper.appendChild(totalSpan);

	const optionsBtn = document.createElement("span");
	optionsBtn.className = "true-recall-link-options";
	optionsBtn.textContent = "\u2026";
	if (onPlay) {
		optionsBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			onPlay();
		});
	}
	wrapper.appendChild(optionsBtn);

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
