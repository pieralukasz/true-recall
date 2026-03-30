import { ObsidianPersistence } from "./adapters/ObsidianPersistence";
import { ObsidianFrontmatter } from "./adapters/ObsidianFrontmatter";
import { ObsidianFileSystem } from "./adapters/ObsidianFileSystem";
import { ObsidianMetadataIndex } from "./adapters/ObsidianMetadataIndex";
import { ObsidianNotification } from "./adapters/ObsidianNotification";
import { ObsidianHttpClient } from "./adapters/ObsidianHttpClient";
export function createObsidianAdapters(app) {
    return {
        persistence: new ObsidianPersistence(app),
        frontmatter: new ObsidianFrontmatter(app),
        fileSystem: new ObsidianFileSystem(app),
        metadataIndex: new ObsidianMetadataIndex(app),
        notification: new ObsidianNotification(),
        httpClient: new ObsidianHttpClient(),
    };
}
