// Syntax + undefined-name check of every source file (needs: npm i -D typescript). Run: node scripts/check.cjs
const ts = require('typescript'), fs = require('fs'), path = require('path');
const files = ['app/page.js', 'app/layout.js', 'lib/supabase.js', 'lib/engine.js', ...fs.readdirSync('components').map((f) => 'components/' + f)].map((f) => path.resolve(f));
const prog = ts.createProgram(files, { allowJs: true, checkJs: true, noEmit: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [], skipLibCheck: true, noResolve: false, strict: false });
const keep = (d) => d.code < 2000 || [2304, 2552, 2451, 2300, 2393].includes(d.code);   // syntax errors, undefined names, duplicate declarations
let n = 0;
for (const f of files) {
  for (const d of [...prog.getSyntacticDiagnostics(prog.getSourceFile(f)), ...prog.getSemanticDiagnostics(prog.getSourceFile(f))].filter(keep)) {
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    console.log(path.relative('.', f) + ':' + (line + 1), ts.flattenDiagnosticMessageText(d.messageText, ' ')); n++;
  }
}
console.log(n ? n + ' problem(s)' : 'syntax and names OK');
