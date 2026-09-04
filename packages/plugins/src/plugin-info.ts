import type { PluginInfo } from "@true-recall/core/types";

import { FEATURE_MANIFESTS } from "./registry";

export const ALL_PLUGINS: PluginInfo[] = FEATURE_MANIFESTS.map((m) => m.info);
