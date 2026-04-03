export default function sqlite3InitModule() {
	throw new Error(
		"@sqlite.org/sqlite-wasm is not available in test environment",
	);
}
