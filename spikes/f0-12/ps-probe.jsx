// Probe: Photoshop version and installed fonts matching the brand families.
var out = ['version=' + app.version];
for (var i = 0; i < app.fonts.length; i++) {
  var f = app.fonts[i];
  if (/Inter|Spartan/i.test(f.family)) out.push(f.family + ' | ' + f.style + ' | ' + f.postScriptName);
}
out.join('\n');
