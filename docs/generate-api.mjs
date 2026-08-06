import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const apiDir = path.join(root, 'docs', 'api');
const sources = ['index.js', 'lib/cachier.js', 'lib/cachier-db.js', 'lib/cachier-files.js', 'lib/director.js', 'lib/sandbox.js', 'lib/template-options.js', 'lib/template-db-options.js', 'lib/template-file-options.js'];
const pages = new Map([
  ['index.js', { file: 'engine.md', title: 'Engine' }],
  ['cachier.js', { file: 'lib/cachier.md', title: 'Cachier' }],
  ['cachier-db.js', { file: 'lib/cachier-db.md', title: 'CachierDB' }],
  ['cachier-files.js', { file: 'lib/cachier-files.md', title: 'CachierFiles' }],
  ['director.js', { file: 'lib/director.md', title: 'Director' }],
  ['sandbox.js', { file: 'lib/sandbox.md', title: 'Sandbox' }],
  ['template-options.js', { file: 'lib/template-options.md', title: 'Template options' }],
  ['template-db-options.js', { file: 'lib/template-db-options.md', title: 'Database template options' }],
  ['template-file-options.js', { file: 'lib/template-file-options.md', title: 'File template options' }]
]);
const supportedTags = new Set(['async', 'example', 'ignore', 'inheritdoc', 'link', 'module', 'override', 'param', 'private', 'property', 'protected', 'return', 'returns', 'see', 'typedef']);
async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
function normalizeLinks(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\{@linkcode\s+([^}|\s]+)(?:\s*[| ]\s*([^}]+))?\}/g, (_m, target, label) => `[\`${(label || target).trim()}\`](${target})`)
    .replace(/\{@link(?:plain)?\s+([^}|\s]+)(?:\s*[| ]\s*([^}]+))?\}/g, (_m, target, label) => `[${(label || target).trim()}](${target})`);
}
function slug(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\s~`!@#$%^&*()_+=[\]{}|\\;:"'“”‘’<>,.?/-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();
}
function typeText(type) { return type?.names?.map(name => `\`${String(name).replace(/\|/g, '\\|')}\``).join(' \\| ') || ''; }
function tableText(value) { return normalizeLinks(value == null ? '' : value).replace(/\r?\n+/g, '<br>').replace(/\|/g, '\\|'); }
function parameterName(param) {
  const dflt = Object.prototype.hasOwnProperty.call(param, 'defaultvalue') ? `=${param.defaultvalue}` : '';
  return param.optional ? `[${param.name}${dflt}]` : param.name;
}
function parameterList(params) { return (params || []).filter(param => param.name && !param.name.includes('.')).map(parameterName).join(', '); }
function ownerName(value) { const parts = String(value || '').replace(/^module:/, '').split(/[~#.]/); return parts[parts.length - 1] || ''; }
function instanceName(value) { return value ? value.charAt(0).toLowerCase() + value.slice(1) : ''; }
function pageForDoclet(doclet) { return pages.get(path.basename(doclet?.meta?.filename || '')); }
function isPublished(doclet) { return Boolean(doclet && !doclet.undocumented && pageForDoclet(doclet) && !doclet.ignore && doclet.access !== 'private' && ['module', 'class', 'function', 'member', 'constant', 'typedef'].includes(doclet.kind)); }
function returnType(doclet) { return (doclet.returns || []).map(item => typeText(item.type)).filter(Boolean).join(' \\| '); }
function inlineCode(value) { return `\`${String(value).replace(/`/g, '\\`')}\``; }
function heading(doclet) {
  const className = ownerName(doclet.memberof);
  const owner = doclet.scope === 'static' ? className : instanceName(className);
  let text;
  if (doclet.kind === 'class') text = `new ${doclet.name}(${parameterList(doclet.params)})`;
  else if (doclet.kind === 'function') text = `${owner ? `${owner}.` : ''}${doclet.name}(${parameterList(doclet.params)})`;
  else text = `${owner ? `${owner}.` : ''}${doclet.name}`;
  const returns = returnType(doclet);
  return returns ? `${inlineCode(text)} ⇒ ${returns}` : inlineCode(text);
}
function docletAnchor(doclet) {
  if (doclet.kind === 'class') return slug(`new-${doclet.name}`);
  const className = ownerName(doclet.memberof);
  const owner = doclet.scope === 'static' ? className : instanceName(className);
  return slug(owner ? `${owner}-${doclet.name}` : doclet.name);
}
function renderTable(title, items) {
  if (!items?.length) return [];
  const hasDefaults = items.some(item => Object.prototype.hasOwnProperty.call(item, 'defaultvalue'));
  const lines = ['', `#### ${title}`, ''];
  lines.push(hasDefaults ? '| Name | Type | Default | Description |' : '| Name | Type | Description |');
  lines.push(hasDefaults ? '| --- | --- | --- | --- |' : '| --- | --- | --- |');
  for (const item of items) {
    const row = [tableText(parameterName(item)), typeText(item.type), tableText(item.description)];
    if (hasDefaults) row.splice(2, 0, tableText(item.defaultvalue));
    lines.push(`| ${row.join(' | ')} |`);
  }
  return lines;
}
function renderReturns(items) {
  if (!items?.length) return [];
  return ['', '#### Returns', '', ...items.map(item => `- ${typeText(item.type)}${item.description ? ` — ${normalizeLinks(item.description)}` : ''}`)];
}
function renderExamples(items) {
  if (!items?.length) return [];
  const lines = ['', '#### Examples', ''];
  for (const example of items) lines.push('```js', String(example).replace(/^<caption>[\s\S]*?<\/caption>\s*/i, '').trimEnd(), '```', '');
  return lines;
}
function renderDoclet(doclet, level, anchor = docletAnchor(doclet)) {
  const lines = [`${'#'.repeat(level)} ${heading(doclet)} {#${anchor}}`, ''];
  const description = normalizeLinks(doclet.classdesc || doclet.description || '');
  if (description) lines.push(description, '');
  if (doclet.augments?.length) lines.push(`**Extends:** ${doclet.augments.map(item => `\`${item}\``).join(', ')}`, '');
  if (doclet.access && doclet.access !== 'public') lines.push(`**Access:** ${doclet.access}`, '');
  if (doclet.async) lines.push('**Async:** yes', '');
  if (doclet.kind === 'typedef' && typeText(doclet.type)) lines.push(`**Type:** ${typeText(doclet.type)}`, '');
  lines.push(...renderTable('Parameters', doclet.params));
  lines.push(...renderTable('Properties', doclet.properties));
  lines.push(...renderReturns(doclet.returns));
  lines.push(...renderExamples(doclet.examples));
  if (doclet.see?.length) lines.push('', '#### See also', '', ...doclet.see.map(item => `- ${normalizeLinks(item)}`));
  return lines;
}
function assignDocletAnchors(doclets) {
  const counts = new Map();
  const anchors = new Map();
  for (const doclet of doclets) {
    const page = pageForDoclet(doclet);
    const base = doclet.kind === 'module' ? slug(page.title) : docletAnchor(doclet);
    const key = `${page.file}\0${base}`;
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);
    anchors.set(doclet, count === 1 ? base : `${base}-${count}`);
  }
  return anchors;
}
function validateUniqueAnchors(markdown, file) {
  const seen = new Set();
  for (const match of markdown.matchAll(/\{#([^}]+)}/g)) {
    if (seen.has(match[1])) throw new Error(`Duplicate API anchor "${match[1]}" in ${file}`);
    seen.add(match[1]);
  }
}
function findParentMember(doclet, doclets, classIndex, visited = new Set()) {
  const key = doclet.longname || `${doclet.memberof}.${doclet.name}`;
  if (!doclet.memberof || visited.has(key)) return undefined;
  visited.add(key);
  const owner = classIndex.get(doclet.memberof) || classIndex.get(ownerName(doclet.memberof));
  for (const parentName of owner?.augments || []) {
    const parent = classIndex.get(parentName) || classIndex.get(ownerName(parentName));
    if (!parent) continue;
    const found = doclets.find(item => item.name === doclet.name && item.scope === doclet.scope && (item.memberof === parent.longname || item.memberof === parent.name));
    if (found) return found;
    const nested = findParentMember({ ...doclet, memberof: parent.longname || parent.name }, doclets, classIndex, visited);
    if (nested) return nested;
  }
  return undefined;
}
function resolveInheritedDoclets(doclets) {
  const classIndex = new Map();
  for (const doclet of doclets) {
    if (doclet.kind === 'class') {
      classIndex.set(doclet.name, doclet);
      classIndex.set(doclet.longname, doclet);
    }
  }
  return doclets.map(doclet => {
    if (!doclet.inheritdoc && !doclet.override) return doclet;
    const parent = findParentMember(doclet, doclets, classIndex);
    if (!parent) return doclet;
    const merged = { ...doclet };
    for (const key of ['description', 'params', 'returns', 'properties', 'examples', 'see', 'type']) {
      if (merged[key] == null || merged[key] === '' || (Array.isArray(merged[key]) && !merged[key].length)) merged[key] = parent[key];
    }
    return merged;
  });
}
function symbolAliases(value) {
  if (!value) return [];
  const original = String(value).trim();
  const withoutRelativePrefix = original.replace(/^\.\//, '');
  const withoutCall = withoutRelativePrefix.replace(/\(\)$/, '');
  const withoutModule = withoutCall.replace(/^module:/, '');
  const dotted = withoutModule.replace(/[~#]/g, '.');
  const withoutPackage = dotted.replace(/^templeo(?:\/options)?[./-]?/, '').replace(/^\.+/, '');
  const aliases = new Set([original, withoutRelativePrefix, withoutCall, withoutModule, dotted, withoutPackage]);
  if (withoutPackage.includes('.')) aliases.add(withoutPackage.split('.').slice(-2).join('.'));
  return [...aliases].filter(Boolean);
}
function addAlias(index, value, entry) {
  for (const alias of symbolAliases(value)) {
    if (!index.has(alias)) index.set(alias, entry);
  }
}
function findLinkTarget(index, target) {
  for (const alias of symbolAliases(target)) {
    const found = index.get(alias);
    if (found) return found;
  }
  return undefined;
}
function relativeLink(fromFile, toFile, anchor) {
  if (path.resolve(fromFile) === path.resolve(toFile)) return `#${anchor}`;
  let rel = path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/').replace(/\.md$/, '');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return `${rel}#${anchor}`;
}
function rewriteLinks(markdown, file, index) {
  let result = markdown.replace(/\[([^\]]+)]\(([^()\s]+(?:\(\))?)\)/g, (match, label, target) => {
    const found = findLinkTarget(index, target);
    if (found) return `[${label}](${relativeLink(file, found.file, found.anchor)})`;
    if (/^(?:https?:|mailto:|\/|\.\/|\.\.\/|#)/.test(target)) return match;
    return match;
  });
  const replacements = [
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-1-basics\.html/g, '/guide/1-basics'],
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-(?:1|2)-cache\.html/g, '/guide/2-cache'],
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-3-examples\.html/g, '/guide/3-examples'],
    [/tutorial-1-basics\.html/g, '/guide/1-basics'],
    [/tutorial-(?:1|2)-cache\.html/g, '/guide/2-cache'],
    [/tutorial-3-examples\.html/g, '/guide/3-examples']
  ];
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  return result;
}
async function renderApiDocsFromDoclets(rawDoclets, outputDir = apiDir) {
  const doclets = resolveInheritedDoclets(rawDoclets).filter(isPublished);
  const groups = new Map([...pages.values()].map(page => [page.file, []]));
  for (const doclet of doclets) groups.get(pageForDoclet(doclet).file).push(doclet);
  for (const group of groups.values()) group.sort((a, b) => (a.meta?.lineno || 0) - (b.meta?.lineno || 0));
  const orderedDoclets = [...groups.values()].flat();
  const anchors = assignDocletAnchors(orderedDoclets);
  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDir(outputDir);
  const targets = new Map([...pages.values()].map(page => [page.file, path.join(outputDir, page.file)]));
  const index = new Map();
  for (const doclet of orderedDoclets) {
    const page = pageForDoclet(doclet);
    const entry = { file: targets.get(page.file), anchor: anchors.get(doclet) };
    addAlias(index, doclet.name, entry);
    addAlias(index, doclet.longname, entry);
    addAlias(index, doclet.memberof && `${doclet.memberof}.${doclet.name}`, entry);
    addAlias(index, doclet.memberof && `${ownerName(doclet.memberof)}.${doclet.name}`, entry);
  }
  for (const page of pages.values()) {
    addAlias(index, page.title, { file: targets.get(page.file), anchor: slug(page.title) });
  }
  for (const page of pages.values()) {
    const file = targets.get(page.file);
    const group = groups.get(page.file);
    const lines = ['---', `title: ${page.title}`, '---', '', `# ${page.title}`, ''];
    for (const moduleDoc of group.filter(item => item.kind === 'module')) {
      if (moduleDoc.description) lines.push(normalizeLinks(moduleDoc.description), '');
      lines.push(...renderExamples(moduleDoc.examples));
    }
    const classes = group.filter(item => item.kind === 'class');
    const consumed = new Set();
    for (const classDoc of classes) {
      lines.push(...renderDoclet(classDoc, 2, anchors.get(classDoc)));
      for (const member of group.filter(item => item.memberof === classDoc.longname || item.memberof === classDoc.name)) {
        consumed.add(member);
        lines.push(...renderDoclet(member, 3, anchors.get(member)));
      }
    }
    for (const doclet of group.filter(item => item.kind !== 'module' && !classes.includes(item) && !consumed.has(item))) lines.push(...renderDoclet(doclet, 2, anchors.get(doclet)));
    const markdown = rewriteLinks(lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n', file, index);
    validateUniqueAnchors(markdown, page.file);
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, markdown, 'utf8');
  }
  const indexLines = ['# API Reference', '', 'Generated from Templeo source JSDoc using JSDoc JSON doclets and the project-owned Markdown renderer.', '', ...[...pages.values()].map(page => `- [${page.title}](/api/${page.file.replace(/\.md$/, '')})`), ''];
  await fs.writeFile(path.join(outputDir, 'index.md'), indexLines.join('\n'), 'utf8');
  return { docletCount: doclets.length, pageCount: pages.size + 1 };
}
function validateSupportedTags(source, filename) {
  for (const block of source.match(/\/\*\*[\s\S]*?\*\//g) || []) {
    const regex = /^\s*\*\s*@([A-Za-z][\w-]*)/gm;
    let match;
    while ((match = regex.exec(block))) {
      if (!supportedTags.has(match[1])) throw new Error(`Unsupported JSDoc tag "@${match[1]}" in ${filename}`);
    }
  }
}
async function generateDoclets() {
  const jsdoc = path.join(root, 'node_modules', 'jsdoc', 'jsdoc.js');
  const args = [jsdoc, '--explain', ...sources.map(file => path.join(root, file))];
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, shell: false });
    let output = '';
    let errors = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`JSDoc exited with code ${code}${errors ? `\n${errors}` : ''}`)));
  });
  return JSON.parse(stdout);
}
async function main() {
  for (const sourceFileName of sources) validateSupportedTags(await fs.readFile(path.join(root, sourceFileName), 'utf8'), sourceFileName);
  const result = await renderApiDocsFromDoclets(await generateDoclets());
  if (!result.docletCount) throw new Error('JSDoc did not produce any publishable API doclets');
  console.log(`Generated ${result.docletCount} API doclets across ${result.pageCount} Markdown pages.`);
}
export { assignDocletAnchors, pageForDoclet, renderApiDocsFromDoclets, resolveInheritedDoclets, typeText, validateSupportedTags, validateUniqueAnchors };
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
