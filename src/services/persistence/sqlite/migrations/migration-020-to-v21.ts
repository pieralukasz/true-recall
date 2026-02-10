/**
 * Migration v20 -> v21
 * Add card_type, cloze_template, cloze_index, reverse_of columns for cloze deletions and reversed cards
 */
import type { DatabaseLike } from "../sqlite.types";

export function migration020ToV21(db: DatabaseLike): void {
	db.run(`ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'basic'`);
	db.run(`ALTER TABLE cards ADD COLUMN cloze_template TEXT`);
	db.run(`ALTER TABLE cards ADD COLUMN cloze_index INTEGER`);
	db.run(`ALTER TABLE cards ADD COLUMN reverse_of TEXT`);

	db.run(`CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type)`);
	db.run(`CREATE INDEX IF NOT EXISTS idx_cards_reverse_of ON cards(reverse_of)`);

	db.run(`UPDATE meta SET value = '21' WHERE key = 'schema_version'`);
}
