import type { PluginInfo } from "@true-recall/core/types";

import { PLUGIN_MANIFESTS } from "./registry";

export const ALL_PLUGINS: PluginInfo[] = PLUGIN_MANIFESTS.map((m) => m.info);
