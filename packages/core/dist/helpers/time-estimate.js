const SECONDS_PER_REVIEW = 8;
const SECONDS_PER_NEW = 30;
const SECONDS_PER_LEARNING = 15;
export function estimateStudyMinutes(due, newCount, learning) {
    const totalSeconds = due * SECONDS_PER_REVIEW +
        newCount * SECONDS_PER_NEW +
        learning * SECONDS_PER_LEARNING;
    return Math.ceil(totalSeconds / 60);
}
export function formatEstimatedTime(minutes) {
    if (minutes < 1)
        return "<1 min";
    if (minutes < 60)
        return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
