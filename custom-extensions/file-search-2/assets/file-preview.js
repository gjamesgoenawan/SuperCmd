ObjC.import('Foundation');
ObjC.import('AppKit');

function run(argv) {
  var filePath = String(argv[0] || '');
  if (filePath[0] !== '/') throw new Error('Expected an absolute file path');
  var attrs = $.NSFileManager.defaultManager.attributesOfItemAtPathError($(filePath), null);
  if (!attrs || attrs.isNil()) throw new Error('File is unavailable');
  function dateMs(key) {
    var value = attrs.objectForKey(key);
    return value && !value.isNil() ? Number(value.timeIntervalSince1970) * 1000 : 0;
  }
  var result = {
    size: Number(ObjC.unwrap(attrs.objectForKey($.NSFileSize))),
    birthtimeMs: dateMs($.NSFileCreationDate),
    mtimeMs: dateMs($.NSFileModificationDate),
    icon: ''
  };
  // AppKit runs on this helper's main thread, isolated from Electron.
  try {
    var icon = $.NSWorkspace.sharedWorkspace.iconForFile($(filePath));
    icon.size = $.NSMakeSize(64, 64);
    var bitmap = $.NSBitmapImageRep.imageRepWithData(icon.TIFFRepresentation);
    var data = bitmap.representationUsingTypeProperties($.NSPNGFileType, $({}));
    if (data && !data.isNil()) result.icon = 'data:image/png;base64,' + ObjC.unwrap(data.base64EncodedStringWithOptions(0));
  } catch (_) { /* Metadata still works if the system has no icon. */ }
  return JSON.stringify(result);
}
