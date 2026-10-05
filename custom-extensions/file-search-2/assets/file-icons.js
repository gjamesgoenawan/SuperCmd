ObjC.import('Foundation');
ObjC.import('AppKit');

function run(argv) {
  var paths = JSON.parse(argv[0] || '[]');
  if (!Array.isArray(paths) || paths.length > 100) throw new Error('Invalid icon batch');
  var result = {};
  paths.forEach(function(filePath) {
    if (typeof filePath !== 'string' || filePath[0] !== '/') return;
    try {
      var icon = $.NSWorkspace.sharedWorkspace.iconForFile($(filePath));
      var thumbnail = $.NSImage.alloc.initWithSize($.NSMakeSize(32, 32));
      thumbnail.lockFocus;
      try {
        icon.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, 32, 32), $.NSZeroRect, $.NSCompositeSourceOver, 1);
      } finally { thumbnail.unlockFocus; }
      var bitmap = $.NSBitmapImageRep.imageRepWithData(thumbnail.TIFFRepresentation);
      var png = bitmap.representationUsingTypeProperties($.NSPNGFileType, $({}));
      result[filePath] = 'data:image/png;base64,' + ObjC.unwrap(png.base64EncodedStringWithOptions(0));
    } catch (_) { /* The extension keeps a file-type fallback if an icon fails. */ }
  });
  return JSON.stringify(result);
}
