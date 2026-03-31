import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { DayOfWeekSelector } from "./easy-days/DayOfWeekSelector";
import { SpecificDatesList } from "./easy-days/SpecificDatesList";
import { Clickable } from "@true-recall/obsidian/components";
import { ModalFooter, SECONDARY_BTN } from "@true-recall/obsidian/components/ModalFooter";
import { BasePromiseModal, } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
import { useState } from "preact/hooks";
function EasyDaysBody({ initialRecurringDays, initialSpecificDates, initialMultiplier, onResolve, }) {
    var _a;
    const [recurringDays, setRecurringDays] = useState(() => new Set(initialRecurringDays));
    const [specificDates, setSpecificDates] = useState(() => new Set(initialSpecificDates));
    const [multiplier, setMultiplier] = useState(initialMultiplier);
    const [dateInputValue, setDateInputValue] = useState(() => { var _a; return (_a = new Date().toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : ""; });
    const today = (_a = new Date().toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
    const toggleDay = (index) => {
        setRecurringDays((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            }
            else {
                next.add(index);
            }
            return next;
        });
    };
    const addDate = () => {
        if (dateInputValue && !specificDates.has(dateInputValue)) {
            setSpecificDates((prev) => new Set([...prev, dateInputValue]));
        }
    };
    const removeDate = (dateStr) => {
        setSpecificDates((prev) => {
            const next = new Set(prev);
            next.delete(dateStr);
            return next;
        });
    };
    const handleSave = (applyNow) => {
        onResolve({
            cancelled: false,
            easyDays: {
                recurringDays: Array.from(recurringDays).sort((a, b) => a - b),
                specificDates: Array.from(specificDates).sort(),
            },
            multiplier,
            applyNow,
        });
    };
    return (_jsxs(_Fragment, { children: [_jsx(DayOfWeekSelector, { selectedDays: recurringDays, onToggleDay: toggleDay }), _jsx(SpecificDatesList, { dates: specificDates, dateInputValue: dateInputValue, today: today, onDateInputChange: setDateInputValue, onAddDate: addDate, onRemoveDate: removeDate }), _jsxs("div", { class: "ep:mb-5", children: [_jsx("h4", { class: "ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal", children: "Workload reduction" }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-3", children: [_jsx("input", { type: "range", class: "ep:flex-1 ep:accent-obs-interactive", min: "0", max: "100", step: "10", value: Math.round(multiplier * 100), onInput: (e) => setMultiplier(parseInt(e.target.value, 10) / 100) }), _jsxs("span", { class: "ep:text-ui-small ep:text-obs-normal ep:w-12 ep:text-right ep:font-medium", children: [Math.round(multiplier * 100), "%"] })] }), _jsx("p", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mt-2", children: "Percentage of normal workload on easy days (0% = no reviews)" })] }), _jsx(ModalFooter, { onCancel: () => onResolve({ cancelled: true }), onConfirm: () => handleSave(true), confirmLabel: "Apply Now", children: _jsx(Clickable, { class: SECONDARY_BTN, onClick: () => handleSave(false), children: "Save" }) })] }));
}
export class EasyDaysModal extends BasePromiseModal {
    constructor(app, options) {
        super(app, { title: "Easy Days Configuration", width: "450px" });
        this.initialRecurringDays = [...options.easyDays.recurringDays];
        this.initialSpecificDates = [...options.easyDays.specificDates];
        this.initialMultiplier = options.multiplier;
    }
    getDefaultResult() {
        return { cancelled: true };
    }
    renderBody(container) {
        render(_jsx(EasyDaysBody, { initialRecurringDays: this.initialRecurringDays, initialSpecificDates: this.initialSpecificDates, initialMultiplier: this.initialMultiplier, onResolve: (result) => this.resolve(result) }), container);
    }
}
