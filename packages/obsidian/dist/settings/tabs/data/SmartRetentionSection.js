import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { FormCard, FormField, InfoBlock, SliderInput, } from "@true-recall/obsidian/components";
function RetentionPolicySlider({ name, description, field, policy, max, onSave, }) {
    return (_jsx(FormField, { name: name, description: description, children: _jsx(SliderInput, { value: policy[field], onChange: (v) => onSave(Object.assign(Object.assign({}, policy), { [field]: v })), min: 0, max: max, step: 1 }) }));
}
export function SmartRetentionSection() {
    const { settings, save } = useSettings();
    const { hourlyBackupsToKeep, dailyBackupsToKeep, weeklyBackupsToKeep } = settings.retentionPolicy;
    const handleSave = (retentionPolicy) => void save({ retentionPolicy });
    return (_jsxs(FormCard, { title: "Smart retention", children: [_jsxs(InfoBlock, { children: [_jsx("p", { children: "Multi-tier retention keeps recent backups densely and older ones sparsely." }), _jsxs("p", { children: ["Current policy:", " ", _jsxs("strong", { children: [hourlyBackupsToKeep, "h / ", dailyBackupsToKeep, "d /", " ", weeklyBackupsToKeep, "w"] })] })] }), _jsx(RetentionPolicySlider, { name: "Hourly backups", description: "Keep one backup per hour for the last N hours (0 = disabled)", field: "hourlyBackupsToKeep", policy: settings.retentionPolicy, max: 48, onSave: handleSave }), _jsx(RetentionPolicySlider, { name: "Daily backups", description: "Keep one backup per day for the last N days (0 = disabled)", field: "dailyBackupsToKeep", policy: settings.retentionPolicy, max: 30, onSave: handleSave }), _jsx(RetentionPolicySlider, { name: "Weekly backups", description: "Keep one backup per week for the last N weeks (0 = disabled)", field: "weeklyBackupsToKeep", policy: settings.retentionPolicy, max: 12, onSave: handleSave })] }));
}
