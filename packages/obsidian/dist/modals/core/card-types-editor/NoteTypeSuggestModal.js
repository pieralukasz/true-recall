import { __awaiter } from "tslib";
import { Notice, SuggestModal } from "obsidian";
import { CardTypesEditorModal } from "./CardTypesEditorModal";
import { CreateNoteTypeModal } from "./CreateNoteTypeModal";
export class NoteTypeSuggestModal extends SuggestModal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder("Choose a note type to edit...");
    }
    getSuggestions(query) {
        const lowerQuery = query.toLowerCase();
        const all = this.plugin.noteTypeService.getAll();
        const filtered = lowerQuery
            ? all.filter((nt) => nt.name.toLowerCase().includes(lowerQuery))
            : all;
        return [...filtered, "create"];
    }
    renderSuggestion(item, el) {
        if (item === "create") {
            el.setText("+ Create new note type");
            el.addClasses(["mod-complex", "u-text-accent"]);
            return;
        }
        const suffix = item.isBuiltin ? " (built-in)" : "";
        const type = item.type === 1 ? " [cloze]" : "";
        el.setText(`${item.name}${type}${suffix}`);
    }
    onChooseSuggestion(item) {
        if (item === "create") {
            void this.handleCreate();
            return;
        }
        new CardTypesEditorModal(this.app, this.plugin, item.id).open();
    }
    handleCreate() {
        return __awaiter(this, void 0, void 0, function* () {
            const allTypes = this.plugin.noteTypeService.getAll();
            const result = yield new CreateNoteTypeModal(this.app, allTypes).openAndWait();
            if (result.cancelled)
                return;
            try {
                let fields = ["Front", "Back"];
                let templates = [
                    { name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
                ];
                let css;
                if (result.cloneFromId) {
                    const source = this.plugin.noteTypeService.getById(result.cloneFromId);
                    if (source) {
                        fields = [...source.fields];
                        templates = source.templates.map((t) => (Object.assign({}, t)));
                        css = source.css;
                    }
                }
                const created = this.plugin.noteTypeService.create({
                    name: result.name,
                    fields,
                    templates,
                    css,
                });
                new CardTypesEditorModal(this.app, this.plugin, created.id).open();
            }
            catch (e) {
                new Notice(e.message);
            }
        });
    }
}
