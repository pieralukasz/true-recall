export function buildSourceUidToPresetMap(presetService, allCards) {
    const map = new Map();
    const seenUids = new Set();
    for (const card of allCards) {
        if (!card.sourceUid || seenUids.has(card.sourceUid))
            continue;
        seenUids.add(card.sourceUid);
        const preset = presetService.resolvePresetForCard(card);
        map.set(card.sourceUid, preset.name);
    }
    return map;
}
export function getSourceUidsForPreset(presetName, sourceUidToPreset) {
    const uids = new Set();
    for (const [uid, name] of sourceUidToPreset) {
        if (name === presetName)
            uids.add(uid);
    }
    return uids;
}
