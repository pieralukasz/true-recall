import type { App } from "obsidian";

import type {
	IFileSystem,
	IFrontmatter,
	IHttpClient,
	IMetadataIndex,
	INotification,
	IPersistence,
} from "@true-recall/core";

import { ObsidianFileSystem } from "./adapters/ObsidianFileSystem";
import { ObsidianFrontmatter } from "./adapters/ObsidianFrontmatter";
import { ObsidianHttpClient } from "./adapters/ObsidianHttpClient";
import { ObsidianMetadataIndex } from "./adapters/ObsidianMetadataIndex";
import { ObsidianNotification } from "./adapters/ObsidianNotification";
import { ObsidianPersistence } from "./adapters/ObsidianPersistence";

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
