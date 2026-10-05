# File Search 2.0

A standalone SuperCmd extension for macOS. Open the command to see your 20 most recently added indexed files. Type to search filenames (case- and accent-insensitive substring search, up to 100 results, newest first).

It also supports native macOS file dragging: search for a file, grab its row, and drop it directly into Google Drive, an email composer, Finder, Slack, or any other application that accepts files.

## What gets built

File Search 2.0 has two parts:

1. The extension in this folder provides the Spotlight search, result list, preview, icons, double-click behavior, and drag gesture.
2. SuperCmd provides a small native drag bridge. The extension sends the selected path through `startFileDrag`, and Electron hands a real macOS file promise to the destination application.

The extension UI itself is plain CommonJS. It does not need a separate bundler: `src/search.js` is copied to `.sc-build/search.js`, which is the file SuperCmd loads.

## Prerequisites

- macOS 26 or newer for this checkout's configured app build
- Apple Silicon for the `arm64` commands below
- Xcode Command Line Tools: `xcode-select --install`
- Node.js and npm
- Spotlight indexing enabled for the folders you want to search

## Build it step by step

Run these commands from the root of the SuperCmd repository.

### 1. Install dependencies

```bash
npm ci
```

### 2. Prepare the extension bundle

After changing `src/search.js`, copy it into the prebuilt command directory:

```bash
cp custom-extensions/file-search-2/src/search.js \
  custom-extensions/file-search-2/.sc-build/search.js
```

The source and prebuilt copy must remain identical. Keep `.sc-build` when copying the extension; it is a hidden directory in Finder.

### 3. Run the interaction tests

```bash
node --test scripts/test-file-search-2-interactions.mjs
```

The tests cover single-click selection, double-click opening, native dragging, preview behavior, virtualized rows, and source/bundle parity.

### 4. Build SuperCmd

```bash
npm run build:main
npm run build:renderer
npm run build:native
```

The native build is important. This repository pins its native deployment target and packaged minimum system version to macOS 26.

### 5. Package an unsigned Apple Silicon app

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false \
  npx electron-builder --mac --arm64 --dir \
  -c.mac.identity=null \
  -c.mac.notarize=false \
  --publish never
```

The resulting application is:

```text
out/mac-arm64/SuperCmd.app
```

This unsigned build is suitable for local testing. Public distribution requires Developer ID signing and Apple notarization.

### 6. Add File Search 2.0 to SuperCmd

1. Launch the newly built `SuperCmd.app`.
2. Open **Settings → Extensions**.
3. Click **Add Folder**.
4. Select `custom-extensions/file-search-2`, the folder containing `package.json`.
5. Open the launcher and run **File Search 2.0**.

### 7. Test the power of dragging

1. Open File Search 2.0 and search for a file you can safely upload.
2. Press and hold on the result row.
3. Drag the row out of SuperCmd.
4. Drop it onto Finder, the Google Drive upload area, or another file destination.
5. Confirm that the destination receives the actual file, rather than its path as text.

Dragging requires the host changes in:

- `src/main/preload.ts` exposes `startFileDrag`.
- `src/main/main.ts` validates the path and calls Electron's `webContents.startDrag`.
- `src/renderer/types/electron.d.ts` declares the bridge for the renderer.

If dragging shows a missing-support message, the extension is running inside an older SuperCmd build. Rebuild and launch the app from `out/mac-arm64/SuperCmd.app`.

## Install on another Mac

1. Copy the `file-search-2` folder into a permanent location, such as `~/SuperCmd Extensions/`.
2. In SuperCmd, open **Settings → Extensions → Add Folder** and select the inner `file-search-2` folder containing `package.json`.
3. Search the launcher for **File Search 2.0** and open it. Assign a shortcut in SuperCmd if desired.

Requires a SuperCmd version supporting custom extension folders, prebuilt `.sc-build` commands, and the Raycast-compatible Node APIs. The extension itself needs no npm, Xcode, native helper, `.pkg`, or app signing. Native cross-app drag additionally requires updating the host app to a build containing the drag bridge. Move the entire folder, including the hidden `.sc-build` directory. If Add Folder is absent, that installation needs a newer SuperCmd version.

## Behavior

- Rows show filename above the path, with file-type icons and a wider (52%) results column. No instructional hover tooltip is shown.

- The right-hand preview shows images, or the file icon for other formats, alongside Name, Where, Type, Size, Created, and Modified metadata. It follows the selected result, including keyboard navigation. Unsupported image formats fall back to their file icon.

- Home scope searches visible items under your home folder, excluding Library. Switch to Downloads, Desktop, or Documents in the dropdown.
- Date Added determines order; missing dates fall back to file creation time. The date tooltip says which was used.
- Only regular files are shown. Hidden paths, build/dependency folders, and incomplete downloads are excluded. Home can include source files; choose Downloads or Documents for a more focused list.
- The empty-query list refreshes every 15 seconds after a request completes. Command-R refreshes manually.
- Last successful recent results are cached locally for the next launch; the first launch must wait for Spotlight. A cache can briefly include a file that has since moved or been deleted.
- Double-click opens a file; single-click does not open it. Return still opens the selected file.
- Drag a result into Finder or an upload target using native file drag. **This requires a SuperCmd build with the `startFileDrag` preload bridge** (included in this repository's main-process changes). Updating only this extension on an older installation enables double-click behavior but cannot enable native drag; it shows an explanatory message instead.
- Command-Return reveals it in Finder. Command-Shift-C copies its path.

Preview metadata and file icons are loaded in a separate `osascript` helper (`assets/file-preview.js`). This avoids Electron's native icon loader, which crashes on this macOS installation; a helper failure leaves the extension running with a fallback preview. List rows use native file icons from the isolated `assets/file-icons.js` helper, cached for reuse, with file-type icons as a fallback.

The extension runs Apple's `NSMetadataQuery` through `/usr/bin/osascript -l JavaScript` using Foundation only; it does not automate Finder or System Events. Queries time out rather than returning a partial list labelled as the newest files. Spotlight indexing can lag behind file creation, and excluded/unindexed locations cannot appear. macOS folder-access permissions still apply. This extension queries Spotlight independently of the built-in File Search index and its protected-roots setting.

This adds a separate command. It does not change the built-in File Search or the main launcher's opening screen.

## Source and packaging

`src/search.js` is plain CommonJS using the React and Raycast API provided by SuperCmd. `.sc-build/search.js` is an identical copy, ready for the loader.

- `assets/spotlight.js` queries Spotlight and orders files by Date Added.
- `assets/file-preview.js` reads preview metadata and the selected file's icon in an isolated process.
- `assets/file-icons.js` loads native icons for result rows in an isolated process.
- `assets/icon.svg` is the extension icon.

After editing the UI source, copy it to `.sc-build/search.js`. Copy the whole folder when sideloading, ensuring hidden files are included. The previously generated ZIP is not updated and does not contain these interaction changes.
