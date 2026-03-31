declare module "*.wasm" {
	const content: ArrayBuffer;
	export default content;
}

declare module "@sqlite.org/sqlite-wasm/sqlite3.wasm" {
	const content: ArrayBuffer;
	export default content;
}
