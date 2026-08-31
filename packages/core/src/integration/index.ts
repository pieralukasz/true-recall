// Integration — Anki import/export, CSV export, device discovery/ID

export { AnkiConverterService } from "./anki/anki-converter.service";
export {
	AnkiExportService,
	type IVaultMediaReader,
} from "./anki/anki-export.service";
export {
	AnkiImportService,
	type CardChangeNotifier,
	type IAnkiImportVault,
} from "./anki/anki-import.service";
export {
	AnkiMediaService,
	type IVaultFileReader,
} from "./anki/anki-media.service";
export {
	AnkiNoteTypeMapper,
	type NoteTypeStore,
	stripHtmlFromTemplate,
} from "./anki/anki-note-type-mapper";
export { AnkiSchedulingService } from "./anki/anki-scheduling.service";
// Moved from obsidian
export { ApkgBuilderService } from "./anki/apkg/apkg-builder.service";
export {
	ApkgParserService,
	parseMediaProtobuf,
	readProtobufString,
	readProtobufVarint,
} from "./anki/apkg/apkg-parser.service";
export { CloudSyncService } from "./cloud/cloud-sync.service";
export type {
	CloudSyncChange,
	CloudSyncExchangeRequest,
	CloudSyncExchangeResponse,
	CloudSyncResult,
	CloudSyncTransport,
} from "./cloud/cloud-sync.types";
export {
	type CsvExportOptions,
	CsvExportService,
	type CsvSeparator,
	type ISourceUidResolver,
} from "./csv/csv-export.service";
export {
	type DeviceDatabaseInfo,
	DeviceDiscoveryService,
} from "./device/device-discovery.service";
export { DeviceIdService } from "./device/device-id.service";
