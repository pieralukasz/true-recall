#!/usr/bin/env bun

import { TrueRecallClient } from "./client.js";
import { serveStdio } from "./server.js";

await serveStdio(new TrueRecallClient());
