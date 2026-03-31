export function shouldImagePanelStartExpanded(imagePath: string): boolean {
	return imagePath.trim().length === 0;
}

export function truncateMiddlePath(path: string, maxLength = 56): string {
	if (path.length <= maxLength) return path;
	if (maxLength <= 5) return path.slice(0, maxLength);

	const maxBody = maxLength - 1; // reserve one char for ellipsis
	const tailLength = Math.min(24, Math.floor(maxBody / 2));
	const headLength = maxBody - tailLength;

	return `${path.slice(0, headLength)}…${path.slice(path.length - tailLength)}`;
}
