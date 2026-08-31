# Cloud Sync E2E

This harness tests the production Cloud Sync client contract without reading or
writing the production Supabase project. The test backend implements the website
authorization exchange and sync endpoint in memory.

It is intended for a real Obsidian desktop app plus the Obsidian Android app on
an emulator or USB device. Do not treat a passing isolated test as proof that
the production migration, Edge Function, and website deployment are live.

## Start the isolated backend

```sh
bun e2e/cloud/server.ts
```

Build a test-only plugin bundle and copy it into the desktop test vault:

```sh
TRUERECALL_WEB_URL=http://127.0.0.1:4174 \
TRUERECALL_CLOUD_SYNC_URL=http://127.0.0.1:4174/cloud-sync \
VAULT=/path/to/TrueRecallCloudSyncE2E \
bun run build
```

For Android, forward the host backend and push the same bundle:

```sh
adb reverse tcp:4174 tcp:4174
adb push main.js manifest.json styles.css \
  /sdcard/Documents/TrueRecallCloudSyncE2E/.obsidian/plugins/true-recall/
```

Run a normal production build after testing so the repository-root bundle does
not retain test endpoints:

```sh
VAULT= TRUERECALL_WEB_URL= TRUERECALL_CLOUD_SYNC_URL= bun run build
```

## Required checks

1. Start sign-in from the desktop plugin, authorize, and confirm the
   `obsidian://true-recall-auth` callback returns to the requesting vault.
2. Start sign-in on Android. Confirm the system opens a browser and then returns
   to the correct Obsidian vault rather than invoking the callback directly.
3. Create different cards on desktop and mobile, sync both, and compare IDs and
   fields on both local SQLite databases.
4. Disconnect Android by removing the reverse (`adb reverse --remove tcp:4174`),
   complete a review, and confirm the local review is retained after a failed
   exchange.
5. Restore the reverse, sync mobile and desktop, and compare the review-log ID,
   card ID, rating, and timestamp.
6. Restart Obsidian Android and confirm the SecretStorage session, local cards,
   review history, and Cloud mode survive.
7. Propagate a deletion and verify the same tombstone on both clients.
8. Edit the same note offline on mobile and later on desktop. After reconnecting,
   confirm both clients converge on the later version.
9. Create manual backups on each device and verify they are separate files under
   `.true-recall/backups.nosync/{device-id}/`.

`e2e/mobile/eval.ts` evaluates assertions inside the running Android WebView over
Chrome DevTools Protocol. No test hooks are included in the shipped plugin.
