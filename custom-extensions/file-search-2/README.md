# File Search 2.0

A standalone SuperCmd extension for macOS. Open the command to see your 20 most recently added indexed files. Type to search filenames (case- and accent-insensitive substring search, up to 100 results, newest first).

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

`src/search.js` is plain CommonJS using the React and Raycast API provided by SuperCmd. `.sc-build/search.js` is an identical copy, ready for the loader. `assets/spotlight.js` is the macOS query helper.

After editing the UI source, copy it to `.sc-build/search.js`. Copy the whole folder when sideloading, ensuring hidden files are included. The previously generated ZIP is not updated and does not contain these interaction changes.
