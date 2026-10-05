import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const source = fs.readFileSync(new URL('../custom-extensions/file-search-2/src/search.js', import.meta.url), 'utf8');
function mount({ error = '', bridge = true } = {}) {
  const opened = [], dragged = [], toasts = [], effects = [], refs = [];
  let state = 0;
  const items = [{ path: '/tmp/a file.pdf', date: 1 }, { path: '/tmp/b.txt', date: 2 }];
  const values = ['', 'home', items, false, error];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: () => [values[state++], () => {}],
    useRef: value => { const ref = { current: value }; refs.push(ref); return ref; },
    useReducer: () => [0, () => {}], useEffect: fn => effects.push(fn)
  };
  const List = Object.assign(() => {}, { Dropdown: { Item: 'DropdownItem' }, Item: 'Item', Section: 'Section', EmptyView: 'EmptyView' });
  const Action = Object.assign(() => {}, { CopyToClipboard: 'Copy' });
  let onMutation;
  const context = { module: { exports: {} }, window: { electron: bridge ? { startFileDrag: value => dragged.push(value) } : {} },
    MutationObserver: class { constructor(fn) { onMutation = fn; } observe() {} disconnect() {} },
    require(name) {
      if (name === 'react') return React;
      if (name === 'path') return path;
      if (name === 'fs') return fs;
      if (name === 'child_process') return {};
      if (name === '@raycast/api') return { List, Action, open: value => opened.push(value), showToast: value => toasts.push(value), Toast: { Style: { Failure: 'failure' } } };
      throw new Error(name);
    }
  };
  vm.runInNewContext(source, context);
  const tree = context.module.exports.default();
  const rows = Array.from({ length: error ? 3 : 2 }, (_, i) => ({ dataset: { idx: String(i) } }));
  refs[0].current = { contains: row => rows.includes(row), querySelectorAll: () => rows };
  effects[1]();
  function event(index) {
    return { target: { closest: () => rows[index] }, stopped: false, prevented: false,
      stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
  }
  return { tree, rows, event, opened, dragged, toasts, onMutation };
}

test('single click does not open; double click opens the clicked file', () => {
  const view = mount();
  const event = view.event(1);
  view.tree.props.onClickCapture(event);
  assert.equal(event.stopped, true);
  assert.deepEqual(view.opened, []);
  view.tree.props.onDoubleClickCapture(view.event(1));
  assert.deepEqual(view.opened, ['/tmp/b.txt']);
});
test('drag uses the native bridge and does not open the file', () => {
  const view = mount();
  assert.equal(view.rows[0].draggable, true);
  const event = view.event(0);
  view.tree.props.onDragStartCapture(event);
  assert.equal(event.prevented, true);
  assert.deepEqual(view.dragged, ['/tmp/a file.pdf']);
  view.tree.props.onDoubleClickCapture(view.event(0));
  assert.deepEqual(view.opened, []);
});
test('an error row does not shift the file being dragged or opened', () => {
  const view = mount({ error: 'refresh failed' });
  assert.equal(view.rows[0].draggable, false);
  view.tree.props.onDoubleClickCapture(view.event(2));
  assert.deepEqual(view.opened, ['/tmp/b.txt']);
});
test('older hosts explain the missing native bridge', () => {
  const view = mount({ bridge: false });
  view.tree.props.onDragStartCapture(view.event(0));
  assert.equal(view.toasts.length, 1);
  assert.deepEqual(view.dragged, []);
});
test('new virtualized rows become draggable', () => {
  const view = mount();
  view.rows[0] = { dataset: { idx: '0' } };
  view.onMutation();
  assert.equal(view.rows[0].draggable, true);
});
test('sideloaded bundle matches source', () => {
  assert.equal(fs.readFileSync(new URL('../custom-extensions/file-search-2/.sc-build/search.js', import.meta.url), 'utf8'), source);
});

test('results enable the preview pane and bind details to each file', () => {
  const view = mount();
  const list = view.tree.children[0];
  assert.equal(list.props.isShowingDetail, true);
  const section = list.children.find(child => child?.type === 'Section');
  assert.equal(section.children[0].props.detail.props.filePath, '/tmp/a file.pdf');
  assert.equal(section.children[1].props.detail.props.filePath, '/tmp/b.txt');
  assert.notEqual(section.children[0].props.detail.props.key, section.children[1].props.detail.props.key);
});

test('preview renders image paths safely and falls back to file icons', () => {
  let state = 0;
  let values = [null, '', false, false];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: () => [values[state++], () => {}], useEffect: () => {}
  };
  const context = { module: { exports: {} }, require(name) {
    if (name === 'react') return React;
    if (name === 'fs') return fs;
    if (name === 'path') return path;
    return {};
  } };
  vm.runInNewContext(source + '\nmodule.exports.preview = FilePreview;', context);
  const filePath = '/tmp/Photo #1? (100%).png';
  const tree = context.module.exports.preview({ filePath });
  const image = tree.children[0].children[0];
  assert.equal(image.type, 'img');
  assert.equal(decodeURIComponent(new URL(image.props.src).pathname), filePath);
  assert.equal(new URL(image.props.src).hash, '');
  assert.equal(new URL(image.props.src).search, '');
  assert.equal(image.props.draggable, false);
  state = 0;
  values = [{ size: 2048, birthtimeMs: 1000, mtimeMs: 2000 }, 'data:image/png;base64,icon', true, false];
  const fallback = context.module.exports.preview({ filePath });
  assert.equal(fallback.children[0].children[0].props.src, 'data:image/png;base64,icon');
  assert(JSON.stringify(fallback).includes('2.0 KB'));
  for (const label of ['Name', 'Where', 'Type', 'Size', 'Created', 'Modified']) {
    assert(JSON.stringify(fallback).includes(label));
  }
});

test('preview helper failures and stale responses cannot update an unmounted pane', () => {
  const effects = [], writes = [], callbacks = [], kills = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: value => [value, next => writes.push(next)], useEffect: fn => effects.push(fn)
  };
  const context = { module: { exports: {} }, setTimeout: () => 1, clearTimeout: () => {}, require(name) {
    if (name === 'react') return React;
    if (name === 'path') return path;
    if (name === '@raycast/api') return { environment: { assetsPath: '/extension/assets' } };
    if (name === 'child_process') return { execFile(command, args, options, callback) {
      assert.equal(command, '/usr/bin/osascript');
      assert.equal(args[2], '/extension/assets/file-preview.js');
      callbacks.push(callback);
      return { kill: () => kills.push(true) };
    } };
    throw new Error(`Unexpected host dependency: ${name}`);
  } };
  vm.runInNewContext(source + '\nmodule.exports.preview = FilePreview;', context);
  context.module.exports.preview({ filePath: '/tmp/example.pdf' });
  const cleanup = effects[0]();
  callbacks[0](new Error('helper crashed'), '');
  assert.equal(writes.at(-1), true); // Show unavailable metadata rather than throwing.
  cleanup();
  const before = writes.length;
  callbacks[0](null, JSON.stringify({ size: 100, icon: 'late' }));
  assert.equal(writes.length, before);
  assert.equal(kills.length, 1);
});
