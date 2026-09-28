# Mobile E2E (Obsidian Android)

Scenario tests that drive the real Obsidian Android app with the plugin
installed, on an emulator or a USB device. They verify the mobile-critical
paths end to end: SQLite WASM boot and schema migration, adding cards
through the quick editor UI, grading in review, review persistence across
an immediate process kill, manual device sync, and the dashboard status
chip.

The suite is intentionally NOT part of `bun run test`. It needs a running
device and takes a few minutes.

## One-time setup

1. Install SDK bits (macOS, Apple Silicon):

   ```sh
   brew install --cask android-commandlinetools
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
   yes | sdkmanager --licenses
   sdkmanager "emulator" "system-images;android-35;google_apis;arm64-v8a"
   echo no | avdmanager create avd -n truerecall-test \
     -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_7
   ```

2. Boot the emulator and install Obsidian (APK from the
   obsidianmd/obsidian-releases GitHub releases):

   ```sh
   $ANDROID_SDK_ROOT/emulator/emulator -avd truerecall-test \
     -no-audio -no-boot-anim -gpu swiftshader_indirect &
   adb install Obsidian-<version>.apk
   ```

3. First run of Obsidian (manual, once): create a vault named `TestVault`
   in Device storage, allow file access, then quit the app
   (`adb shell am force-stop md.obsidian`).

4. Push a test note, then reopen and choose "Trust author and enable
   plugins". The plugin files come later: the suite installs the current
   build itself in S1.

   ```sh
   V=/sdcard/Documents/TestVault
   adb shell mkdir -p $V/.obsidian/plugins/true-recall
   adb shell "printf '[\"true-recall\"]' > $V/.obsidian/community-plugins.json"
   adb shell "printf '# Biology\n\nNotatka testowa.\n' > $V/Biology.md"
   adb shell am start -n md.obsidian/.MainActivity
   ```

## Running

```sh
env -u VAULT bun run build   # the suite installs this build on the device
bun e2e/mobile/run.ts
```

Run it before every release. It is the only test that loads the real
plugin build in Obsidian on a phone, including databases left by older
releases.

Environment overrides:

| Variable           | Default                          | Meaning                                  |
| ------------------ | -------------------------------- | ---------------------------------------- |
| `E2E_VAULT`        | `/sdcard/Documents/TestVault`    | Vault path on the device                 |
| `E2E_NOTE`         | `Biology`                        | Note the scenarios use                   |
| `E2E_UPGRADE_FROM` | one release per older schema     | Releases to upgrade from, comma-separated |
| `ADB`              | `adb` from PATH or homebrew path | adb binary                               |

Requirements on the host: `bun`, `sqlite3`, `adb`. Exactly one device or
emulator attached. The suite also verifies that the vault active in Obsidian
matches the final path segment of `E2E_VAULT`, so it cannot silently exercise a
different registered vault. When several vaults are registered, open the
test vault first: `adb shell am start -a android.intent.action.VIEW -d
"obsidian://open?vault=TestVault" md.obsidian`.

## What each scenario checks

| Scenario | Assertion |
| --- | --- |
| S1 | Installs this checkout's build; the plugin loads with that version, SQLite WASM store ready, `schema_version` equals `CURRENT_SCHEMA_VERSION`, device id is local 8-char, only the 4 mobile-allowed views are registered |
| S1-upgrade | For each older schema, puts the database a released version created (`packages/core/tests/fixtures/schema-history`) on the device and restarts: the plugin opens it without auto-recovery, upgrades it, keeps its card and review, and writes the new schema to disk. Replaces the test vault's database |
| S2 | "Add flashcard to current note" opens the full-screen editor; typing + "Save & add another" and "Done" create two cards in the DB |
| S3 | Review of the current note opens, Show answer + Good writes a `review_log` row |
| S4 | Grade, HOME, 1.2 s, `am force-stop`: the review log is already on disk; after relaunch the in-memory store matches the disk |
| S5 | The "Sync devices now" command runs and reports a notice |
| S6 | The dashboard renders the "Saved locally / Synced" status chip |

A failed plugin load fails fast with the notice text ("True Recall could not
load the database") instead of waiting for a timeout.

Scenarios are idempotent: each run tags its cards with a unique suffix and
creates the two cards it later grades, so a vault can be reused across runs.

## Upgrade fixtures

Each file in `packages/core/tests/fixtures/schema-history` is the database a
released version created, generated from that release's own source:

```sh
bun scripts/snapshot-schema-fixture.ts 2.6.1
```

When a release changes `SqliteSchemaManager.ts`, snapshot the previous
release before bumping `CURRENT_SCHEMA_VERSION`. The unit test
`schema-upgrade.test.ts` fails when an older schema version has no fixture,
and it loads every fixture through the startup path on each `bun run test`.

## Notes

- The suite talks to the WebView through the Chrome DevTools Protocol
  (`adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>`),
  so no test hooks ship inside the plugin.
- If Gboard ever collapses into a floating pill on the emulator (it hides
  the keyboard and confuses screenshots), reset it:
  `adb shell pm clear com.google.android.inputmethod.latin`.
