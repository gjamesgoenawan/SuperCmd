ObjC.import('Foundation');

function run(argv) {
  var input = JSON.parse(argv[0] || '{}');
  if (['home', 'Downloads', 'Desktop', 'Documents'].indexOf(input.scope) < 0) throw new Error('Unknown search folder');
  var home = ObjC.unwrap($.NSHomeDirectory());
  var scope = input.scope === 'home' ? home : home + '/' + input.scope;
  var query = $.NSMetadataQuery.alloc.init;
  var scopes = [scope];
  if (input.scope === 'home') {
    var names = ObjC.deepUnwrap($.NSFileManager.defaultManager.contentsOfDirectoryAtPathError($(home), null)) || [];
    scopes = names.filter(function(name) { return name[0] !== '.' && name !== 'Library'; })
      .map(function(name) { return home + '/' + name; });
  }
  query.searchScopes = $(scopes);
  var text = String(input.query || '').trim();
  // Format arguments keep user text out of the predicate grammar.
  query.predicate = text
    ? $.NSPredicate.predicateWithFormatArgumentArray('kMDItemFSName CONTAINS[cd] %@', $([text]))
    : $.NSPredicate.predicateWithFormat('kMDItemContentTypeTree == "public.data"');
  query.sortDescriptors = $([
    $.NSSortDescriptor.sortDescriptorWithKeyAscending('kMDItemDateAdded', false),
    $.NSSortDescriptor.sortDescriptorWithKeyAscending('kMDItemFSCreationDate', false)
  ]);
  if (!query.startQuery) throw new Error('Spotlight could not start the query.');
  var deadline = Date.now() + 10000;
  do {
    $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.05));
  } while (query.isGathering && Date.now() < deadline);
  if (query.isGathering) {
    query.stopQuery;
    throw new Error('Spotlight is still indexing. Please try again.');
  }
  query.disableUpdates;
  var excluded = /(^|\/)(\.[^/]+|node_modules|vendor|dist|build|out|target|coverage|__pycache__|venv|tmp|temp|logs)(\/|$)/i;
  var results = [];
  var manager = $.NSFileManager.defaultManager;
  function dateMs(item, key) {
    var value = item.valueForAttribute($(key));
    if (!value || value.isNil()) return 0;
    return Number(value.timeIntervalSince1970) * 1000 || 0;
  }
  try {
    for (var i = 0; i < query.resultCount; i++) {
      var item = query.resultAtIndex(i);
      var file = ObjC.unwrap(item.valueForAttribute('kMDItemPath'));
      if (!file || file.indexOf(scope + '/') !== 0) continue;
      var relative = file.slice(home.length + 1);
      if (excluded.test(relative) || /^Library\//.test(relative) || /\.(tmp|log|cache|crdownload|download)$/i.test(file)) continue;
      var attrs = manager.attributesOfItemAtPathError($(file), null);
      if (!attrs || attrs.isNil() || ObjC.unwrap(attrs.objectForKey($.NSFileType)) !== 'NSFileTypeRegular') continue;
      var added = dateMs(item, 'kMDItemDateAdded');
      var created = dateMs(item, 'kMDItemFSCreationDate');
      results.push({ path: file, date: added || created, dateKind: added ? 'Added' : 'Created' });
    }
  } finally { query.stopQuery; }
  results.sort(function(a, b) { return b.date - a.date || a.path.localeCompare(b.path); });
  return JSON.stringify(results.slice(0, text ? 100 : 20));
}
