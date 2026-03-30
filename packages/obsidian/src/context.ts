import type {
	IPersistence,
	IFrontmatter,
	IFileSystem,
	IMetadataIndex,
	INotification,
	IHttpClient,
} from "@true-recall/core";
import type { App } from "obsidian";
import { ObsidianPersistence } from "./adapters/ObsidianPersistence";
import { ObsidianFrontmatter } from "./adapters/ObsidianFrontmatter";
import { ObsidianFileSystem } from "./adapters/ObsidianFileSystem";
import { ObsidianMetadataIndex } from "./adapters/ObsidianMetadataIndex";
import { ObsidianNotification } from "./adapters/ObsidianNotification";
import { ObsidianHttpClient } from "./adapters/ObsidianHttpClient";

export interface ObsidianAdapters {
	persistence: IPersistence;
	frontmatter: IFrontmatter;
	fileSystem: IFileSystem;
	metadataIndex: IMetadataIndex;
	notification: INotification;
	httpClient: IHttpClient;
}

export function createObsidianAdapters(app: App): ObsidianAdapters {
	return {
		persistence: new ObsidianPersistence(app),
		frontmatter: new ObsidianFrontmatter(app),
		fileSystem: new ObsidianFileSystem(app),
		metadataIndex: new ObsidianMetadataIndex(app),
		notification: new ObsidianNotification(),
		httpClient: new ObsidianHttpClient(),
	};
}
