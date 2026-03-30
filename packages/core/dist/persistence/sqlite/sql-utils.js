export function sqlPlaceholders(count) {
    return Array.from({ length: count }, () => "?").join(",");
}
