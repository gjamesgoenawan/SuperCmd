const React = require('react');
const { List, Action, ActionPanel, environment, open, showInFinder, LocalStorage, showToast, Toast } = require('@raycast/api');
const { execFile } = require('child_process');
const path = require('path');
const h = React.createElement;
const cache = new Map();
const rowIconCache = new Map();
const ROW_STYLES = `
/* Match the built-in filename/path layout within the host's 36px virtual rows. */
.fs2-root .w-1\\/3 { width: 52%; min-width: 0; flex-shrink: 0; }
.fs2-root .w-1\\/3 + div { min-width: 0; }
.fs2-root [data-idx] { height: 36px; min-height: 36px; box-sizing: border-box; padding-top: 2px; padding-bottom: 2px; }
.fs2-root [data-idx] > div { display: grid; grid-template-columns: 20px minmax(0, 1fr); grid-template-rows: 16px 12px; column-gap: 8px; row-gap: 0; }
.fs2-root [data-idx] > div > div:first-child { grid-column: 1; grid-row: 1 / 3; align-self: center; }
.fs2-root [data-idx] > div > div:nth-child(2) { grid-column: 2; grid-row: 1; }
.fs2-root [data-idx] > div > div:nth-child(2) > span { font-size: 12px; line-height: 16px; font-weight: 500; }
.fs2-root [data-idx] > div > span { grid-column: 2; grid-row: 2; max-width: none; min-width: 0; font-size: 10px; line-height: 12px; text-align: left; }
`;
function fallbackRowIcon(filePath) {
  const extension = path.extname(filePath).slice(1).toUpperCase() || 'FILE';
  const color = /^(PNG|JPG|JPEG|GIF|WEBP|SVG|HEIC)$/.test(extension) ? '#7c3aed'
    : extension === 'PDF' ? '#dc2626' : /^(ZIP|GZ|DMG|TAR)$/.test(extension) ? '#b7791f'
    : /^(JS|TS|TSX|JSON|PY|HTML|CSS)$/.test(extension) ? '#2563eb' : '#64748b';
  const label = extension.replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 2h12l7 7v21H7z" fill="${color}"/><path d="M19 2v7h7" fill="#ffffff" opacity=".35"/><text x="16" y="23" text-anchor="middle" fill="white" font-family="sans-serif" font-size="7" font-weight="bold">${label}</text></svg>`);
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.tiff', '.tif', '.heic', '.avif']);
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(1)} ${units[unit]}`;
}
function fileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return 'Image';
  if (extension === '.pdf') return 'PDF Document';
  if (extension === '.dmg') return 'Disk Image';
  return extension ? `${extension.slice(1).toUpperCase()} File` : 'File';
}
function previewUrl(filePath) {
  // Encode each segment so filenames containing #, ?, %, or spaces stay intact.
  return 'sc-asset://ext-asset' + filePath.split('/').map(encodeURIComponent).join('/');
}
function FilePreview({ filePath }) {
  const [stats, setStats] = React.useState(null);
  const [icon, setIcon] = React.useState('');
  const [imageFailed, setImageFailed] = React.useState(false);
  const [metadataError, setMetadataError] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setStats(null);
    setIcon('');
    setImageFailed(false);
    setMetadataError(false);
    let deadline;
    // Native icon extraction is isolated: an AppKit failure must not kill the host.
    const child = execFile('/usr/bin/osascript', ['-l', 'JavaScript',
      path.join(environment.assetsPath, 'file-preview.js'), filePath],
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
        clearTimeout(deadline);
        if (cancelled) return;
        try {
          if (error) throw error;
          const value = JSON.parse(stdout);
          setStats(value);
          setIcon(typeof value.icon === 'string' ? value.icon : '');
        } catch (_) { setMetadataError(true); }
      });
    deadline = setTimeout(() => child.kill(), 5000);
    return () => { cancelled = true; clearTimeout(deadline); child.kill(); };
  }, [filePath]);
  const image = IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()) && !imageFailed;
  const date = value => Number.isFinite(value) && value > 0 ? new Date(value).toLocaleString() : '—';
  const rows = [
    ['Name', path.basename(filePath)], ['Where', path.dirname(filePath)],
    ['Type', fileType(filePath)], ['Size', stats ? formatFileSize(stats.size) : '—'],
    ['Created', date(stats?.birthtimeMs)], ['Modified', date(stats?.mtimeMs)]
  ];
  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 14, overflowY: 'auto', color: 'var(--text-primary)' } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 120, overflow: 'hidden', borderRadius: 12, background: 'var(--launcher-card-bg)' } },
      image ? h('img', { src: previewUrl(filePath), alt: path.basename(filePath), draggable: false,
        style: { width: '100%', height: '100%', maxHeight: 300, objectFit: 'contain', padding: 8 }, onError: () => setImageFailed(true) })
        : icon ? h('img', { src: icon, alt: fileType(filePath), draggable: false, style: { width: 64, height: 64, objectFit: 'contain' } })
        : h('span', { style: { color: 'var(--text-muted)', fontSize: 13 } }, fileType(filePath))),
    h('div', { style: { flexShrink: 0, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ui-divider)' } },
      h('div', { style: { fontSize: 14, fontWeight: 600, marginBottom: 8 } }, 'Metadata'),
      ...rows.map(([label, value]) => h('div', { key: label, style: { display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr)', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--ui-divider)', fontSize: 11 } },
        h('span', { style: { color: 'var(--text-muted)' } }, label),
        h('span', { title: value, style: { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, value))),
      metadataError ? h('p', { style: { color: 'var(--text-muted)', fontSize: 11 } }, 'File details unavailable. The file may have moved or access may be restricted.') : null)
  );
}

function Command() {
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState('home');
  const [results, setResults] = React.useState(cache.get('home') || []);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [rowIcons, setRowIcons] = React.useState({});
  const listRoot = React.useRef(null);
  const lastDrag = React.useRef(0);
  const [revision, refresh] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    let disposed = false;
    let child;
    let repeat;
    let deadline;
    let completed = false;
    if (!query.trim() && !cache.has(scope)) {
      LocalStorage.getItem('recent-v1-' + scope).then(raw => {
        if (disposed || completed || !raw) return;
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) setResults(items);
        } catch {}
      }).catch(() => {});
    }
    setError('');
    setLoading(true);
    setResults(query.trim() ? [] : cache.get(scope) || []);
    const load = () => {
      if (disposed) return;
      setLoading(true);
      child = execFile('/usr/bin/osascript', ['-l', 'JavaScript',
        path.join(environment.assetsPath, 'spotlight.js'), JSON.stringify({ query, scope })],
        { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
          clearTimeout(deadline);
          if (disposed) return;
          completed = true;
          try {
            if (err) throw err;
            const items = JSON.parse(stdout);
            if (!Array.isArray(items)) throw new Error('Unexpected Spotlight response');
            setResults(items);
            setError('');
            if (!query.trim()) {
              cache.set(scope, items);
              LocalStorage.setItem('recent-v1-' + scope, JSON.stringify(items)).catch(() => {});
            }
          } catch (failure) {
            setError(String(failure.message || failure));
          } finally {
            setLoading(false);
            if (!query.trim()) repeat = setTimeout(load, 15000);
          }
        });
      // SuperCmd versions differ in whether execFile's timeout option is honored.
      deadline = setTimeout(() => child && child.kill(), 20000);
    };
    const timer = setTimeout(load, query.trim() ? 220 : 0);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(repeat);
      clearTimeout(deadline);
      if (child) child.kill();
    };
  }, [query, scope, revision]);
  // Older SuperCmd List rows activate on a single click and ignore DOM props.
  // Keep the compatibility adapter scoped to this extension's rendered rows.
  const fileForEvent = event => {
    const row = event.target.closest?.('[data-idx]');
    if (!row || !listRoot.current?.contains(row)) return null;
    return results[Number(row.dataset.idx) - (error ? 1 : 0)] || null;
  };
  React.useEffect(() => {
    const root = listRoot.current;
    if (!root) return;
    const markRows = () => root.querySelectorAll('[data-idx]').forEach(row => {
      const item = results[Number(row.dataset.idx) - (error ? 1 : 0)];
      row.draggable = Boolean(item);
      row.title = '';
    });
    markRows();
    // List virtualizes its rows, so newly mounted rows also need the attribute.
    const observer = new MutationObserver(markRows);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [results, error]);
  React.useEffect(() => {
    let cancelled = false;
    const known = {};
    const missing = [];
    for (const item of results) {
      if (rowIconCache.has(item.path)) known[item.path] = rowIconCache.get(item.path);
      else missing.push(item.path);
    }
    setRowIcons(known);
    if (!missing.length) return;
    let deadline;
    const child = execFile('/usr/bin/osascript', ['-l', 'JavaScript',
      path.join(environment.assetsPath, 'file-icons.js'), JSON.stringify(missing.slice(0, 100))],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
        clearTimeout(deadline);
        if (cancelled || error) return;
        try {
          const icons = JSON.parse(stdout);
          for (const filePath of missing) {
            const icon = icons[filePath];
            if (typeof icon !== 'string' || !icon.startsWith('data:image/png;base64,')) continue;
            rowIconCache.set(filePath, icon);
            known[filePath] = icon;
          }
          while (rowIconCache.size > 500) rowIconCache.delete(rowIconCache.keys().next().value);
          setRowIcons({ ...known });
        } catch (_) { /* Keep the file-type fallbacks if the helper fails. */ }
      });
    deadline = setTimeout(() => child.kill(), 10000);
    return () => { cancelled = true; clearTimeout(deadline); child.kill(); };
  }, [results]);
  const rowInteractions = {
    ref: listRoot,
    className: 'fs2-root',
    style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 },
    onClickCapture: event => {
      if (fileForEvent(event)) event.stopPropagation();
    },
    onDoubleClickCapture: event => {
      const item = fileForEvent(event);
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - lastDrag.current > 500) open(item.path);
    },
    onDragStartCapture: event => {
      const item = fileForEvent(event);
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      lastDrag.current = Date.now();
      if (typeof window.electron?.startFileDrag === 'function') {
        window.electron.startFileDrag(item.path);
      } else {
        showToast({ style: Toast.Style.Failure, title: 'This SuperCmd version needs native file dragging support',
          message: 'Update SuperCmd to the build with startFileDrag. You can still Reveal in Finder and drag from there.' });
      }
    }
  };
  const refreshAction = h(Action, { title: 'Refresh', onAction: refresh, shortcut: { modifiers: ['cmd'], key: 'r' } });
  return h('div', rowInteractions, h(List, {
    isShowingDetail: true, isLoading: loading, filtering: false, searchText: query, onSearchTextChange: setQuery,
    searchBarPlaceholder: 'Search filenames…', navigationTitle: 'File Search 2.0',
    searchBarAccessory: h(List.Dropdown, { tooltip: 'Search folder', value: scope, onChange: setScope },
      ...['home', 'Downloads', 'Desktop', 'Documents'].map(value => h(List.Dropdown.Item, {
        key: value, value, title: value === 'home' ? 'Home' : value
      })))
  },
    error ? h(List.Item, { key: 'error', title: 'Could not refresh Spotlight results', subtitle: error,
      actions: h(ActionPanel, null, refreshAction) }) : null,
    !results.length && !error ? h(List.EmptyView, {
      title: loading ? 'Searching Spotlight…' : 'No indexed files found',
      description: 'Try another folder or search. Results depend on Spotlight indexing and macOS folder access.'
    }) : null,
    h(List.Section, { title: query.trim() ? 'Search Results' : 'Recently Added', subtitle: query.trim() ? 'Up to 100 files · newest first' : '20 newest files' },
      ...results.map(item => h(List.Item, {
        key: item.path, id: item.path, title: path.basename(item.path), subtitle: path.dirname(item.path),
        icon: rowIcons?.[item.path] || fallbackRowIcon(item.path),
        detail: h(FilePreview, { key: item.path, filePath: item.path }),
        actions: h(ActionPanel, null,
          h(Action, { title: 'Open File', onAction: () => open(item.path) }),
          h(Action, { title: 'Reveal in Finder', onAction: () => showInFinder(item.path), shortcut: { modifiers: ['cmd'], key: 'return' } }),
          h(Action.CopyToClipboard, { title: 'Copy Path', content: item.path, shortcut: { modifiers: ['cmd', 'shift'], key: 'c' } }),
          refreshAction)
      })))
  ), h('style', null, ROW_STYLES));
}
module.exports = { default: Command };
