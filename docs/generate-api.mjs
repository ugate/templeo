import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const stageRoot = path.join(root, 'vpjsdocsrc');
const stageSource = path.join(stageRoot, 'src');
const docsDir = path.join(root, 'docs');
const apiDir = path.join(docsDir, 'api');

async function rmrf(target) {
  await fs.rm(target, { recursive: true, force: true });
}


async function cleanGeneratedDocs() {
  await rmrf(apiDir);
  await rmrf(path.join(docsDir, 'api__index__.md'));
  await rmrf(path.join(docsDir, 'apitypedefs.md'));
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function copyJsTree(srcDir, destDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyJsTree(src, dest);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      await copyFile(src, dest);
    }
  }
}

async function walkFiles(dir, filter, results = []) {
  if (!(await exists(dir))) return results;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, filter, results);
    } else if (entry.isFile() && filter(full)) {
      results.push(full);
    }
  }
  return results;
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/[.\s/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function headingTextToAutoId(title) {
  return slug(title);
}

function relDocLink(fromFile, toFile, anchor = '') {
  if (path.resolve(fromFile) === path.resolve(toFile)) {
    return anchor ? `#${anchor}` : '#';
  }

  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile).replace(/\\/g, '/');
  rel = rel.replace(/\.md$/i, '');
  if (rel === 'index') rel = './';
  else if (!rel.startsWith('.')) rel = './' + rel;
  return anchor ? `${rel}#${anchor}` : rel;
}

function addSymbolAlias(symbolIndex, symbol, entry) {
  if (!symbol) return;

  const aliases = new Set([
    symbol,
    symbol.replace(/^module:/, ''),
    symbol.replace(/~/g, '.'),
    symbol.replace(/^module:templeo[./-]?/, ''),
    symbol.replace(/^module:templeo\/options[./-]?/, ''),
    symbol.replace(/^templeo[./-]?/, '')
  ]);

  for (const alias of aliases) {
    if (!alias) continue;
    symbolIndex.set(alias, entry);

    const member = /^([a-z][A-Za-z0-9_$]*)\.(.+)$/.exec(alias);
    if (member) {
      const owner = member[1];
      const capOwner = owner.charAt(0).toUpperCase() + owner.slice(1);
      symbolIndex.set(`${owner}.${member[2]}`, entry);
      symbolIndex.set(`${capOwner}.${member[2]}`, entry);
    }
  }
}

function deriveHeadingSymbols(title) {
  const clean = title.replace(/`/g, '').trim();
  const symbols = new Set([clean]);

  const token = clean.match(/^([A-Za-z][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+)*)/);
  if (token) {
    const value = token[1];
    symbols.add(value);

    const member = /^([a-z][A-Za-z0-9_$]*)\.(.+)$/.exec(value);
    if (member) {
      const owner = member[1];
      const capOwner = owner.charAt(0).toUpperCase() + owner.slice(1);
      symbols.add(`${owner}.${member[2]}`);
      symbols.add(`${capOwner}.${member[2]}`);
    }

    if (value.startsWith('typedefs.')) {
      symbols.add(value.slice('typedefs.'.length));
    }
  }

  return [...symbols];
}

function knownSymbolTarget(symbol) {
  const normalized = String(symbol)
    .replace(/^module:/, '')
    .replace(/~/g, '.')
    .replace(/^templeo[./-]?/, '')
    .replace(/^options[./-]?/, '');

  if (normalized === 'Engine' || normalized.startsWith('Engine.')) {
    return path.join(apiDir, 'engine.md');
  }
  if (normalized === 'CachierDB' || normalized.startsWith('CachierDB.')) {
    return path.join(apiDir, 'lib', 'cachier-db.md');
  }
  if (normalized === 'CachierFiles' || normalized.startsWith('CachierFiles.')) {
    return path.join(apiDir, 'lib', 'cachier-files.md');
  }
  if (normalized === 'Cachier' || normalized.startsWith('Cachier.')) {
    return path.join(apiDir, 'lib', 'cachier.md');
  }
  if (normalized === 'Director' || normalized.startsWith('Director.')) {
    return path.join(apiDir, 'lib', 'director.md');
  }
  if (normalized === 'Sandbox' || normalized.startsWith('Sandbox.')) {
    return path.join(apiDir, 'lib', 'sandbox.md');
  }
  if (normalized === 'DBOptions' || normalized === 'TemplateDBOpts' || normalized.startsWith('DBOptions.')) {
    return path.join(apiDir, 'lib', 'template-db-options.md');
  }
  if (normalized === 'FileOptions' || normalized === 'TemplateFileOpts' || normalized.startsWith('FileOptions.')) {
    return path.join(apiDir, 'lib', 'template-file-options.md');
  }
  if (normalized === 'Options' || normalized === 'TemplateOpts' || normalized.startsWith('Options.')) {
    return path.join(apiDir, 'lib', 'template-options.md');
  }
  return null;
}

async function stageSources() {
  await rmrf(stageRoot);
  await ensureDir(stageSource);

  for (const file of ['index.js']) {
    const src = path.join(root, file);
    if (await exists(src)) await copyFile(src, path.join(stageSource, file));
  }

  const libDir = path.join(root, 'lib');
  if (await exists(libDir)) await copyJsTree(libDir, path.join(stageSource, 'lib'));

  const files = await walkFiles(stageSource, file => file.endsWith('.js'));
  if (!files.length) throw new Error(`No staged source files found in ${stageSource}`);
}

async function runGenerator() {
  const args = [
    'vitepress-jsdoc',
    '--source', './vpjsdocsrc/src',
    '--dist', './docs',
    '--folder', 'api',
    '--title', 'API Reference',
    '--readme', './README.md'
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
      cwd: root,
      stdio: 'inherit',
      shell: false
    });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`vitepress-jsdoc exited with code ${code}`)));
    child.on('error', reject);
  });
}

async function moveIfExists(fromRel, toRel) {
  const from = path.join(root, fromRel);
  const to = path.join(root, toRel);
  if (!(await exists(from))) return false;
  await ensureDir(path.dirname(to));
  if (await exists(to)) await rmrf(to);
  await fs.rename(from, to);
  return true;
}

async function writeApiIndex() {
  const apiIndex = path.join(apiDir, 'index.md');
  const lines = [
    '# API Reference',
    '',
    'Generated API pages:',
    '',
    '- [Engine](/api/engine)',
    '- [Cachier](/api/lib/cachier)',
    '- [CachierDB](/api/lib/cachier-db)',
    '- [CachierFiles](/api/lib/cachier-files)',
    '- [Director](/api/lib/director)',
    '- [Sandbox](/api/lib/sandbox)',
    '- [Template options](/api/lib/template-options)',
    '- [Database template options](/api/lib/template-db-options)',
    '- [File template options](/api/lib/template-file-options)',
    ''
  ];
  await ensureDir(path.dirname(apiIndex));
  await fs.writeFile(apiIndex, lines.join('\n'), 'utf8');
}

async function normalizeOutput() {
  await ensureDir(path.join(apiDir, 'lib'));

  const moves = [
    ['docs/api__index__.md', 'docs/api/engine.md'],
    ['docs/api/__index__.md', 'docs/api/engine.md']
  ];

  for (const [fromRel, toRel] of moves) {
    await moveIfExists(fromRel, toRel);
  }

  await rmrf(path.join(apiDir, 'README.md'));
  await rmrf(path.join(apiDir, '__index__.md'));

  await writeApiIndex();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function normalizeInlineCodeTags(md) {
  return md.replace(/<code>([\s\S]*?)<\/code>/gi, (_match, content) => {
    const decoded = decodeHtmlEntities(content);
    const runs = decoded.match(/`+/g) || [];
    const width = Math.max(1, ...runs.map(run => run.length + 1));
    const fence = '`'.repeat(width);
    return `${fence}${decoded}${fence}`;
  });
}

function normalizeGuideLinks(md) {
  md = md.replace(
    '[Engine.register](module-templeo-Engine.html#register __or__ when an [include](tutorial-1-basics.html#include)',
    '[Engine.register](/api/engine) or when an [include](/guide/1-basics#include)'
  );

  const replacements = [
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-1-basics\.html/g, '/guide/1-basics'],
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-1-cache\.html/g, '/guide/2-cache'],
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-2-cache\.html/g, '/guide/2-cache'],
    [/https:\/\/ugate\.github\.io\/templeo\/tutorial-3-examples\.html/g, '/guide/3-examples'],
    [/https:\/\/ugate\.github\.io\/templeo\/module-templeo-Engine\.html(?:#[A-Za-z0-9_.-]+)?/g, '/api/engine'],
    [/tutorial-1-basics\.html/g, '/guide/1-basics'],
    [/tutorial-1-cache\.html/g, '/guide/2-cache'],
    [/tutorial-2-cache\.html/g, '/guide/2-cache'],
    [/tutorial-3-examples\.html/g, '/guide/3-examples'],
    [/index\.html#caching/g, '/#caching'],
    [/module-templeo(?:-|\.)Engine\.html(?:#[A-Za-z0-9_.-]+)?/g, '/api/engine'],
    [/CachierDB\.html(?:#[A-Za-z0-9_.-]+)?/g, '/api/lib/cachier-db'],
    [/CachierFiles\.html(?:#[A-Za-z0-9_.-]+)?/g, '/api/lib/cachier-files'],
    [/Cachier\.html(?:#[A-Za-z0-9_.-]+)?/g, '/api/lib/cachier'],
    [/module-templeo_options\.html#\.DBOptions/g, '/api/lib/template-db-options'],
    [/module-templeo_options\.html#\.FileOptions/g, '/api/lib/template-file-options'],
    [/module-templeo_options\.html(?:#\.Options)?/g, '/api/lib/template-options']
  ];

  for (const [pattern, replacement] of replacements) {
    md = md.replace(pattern, replacement);
  }
  return md;
}

async function buildSymbolIndex(mdFiles) {
  const symbolIndex = new Map();
  const rewritten = new Map();

  for (const file of mdFiles) {
    let md = await fs.readFile(file, 'utf8');

    md = md.replace(
      /<a\s+(?:name|id)="([^"]+)"><\/a>\s*\n(#{1,6})\s+(.+)$/gm,
      (_m, symbol, hashes, title) => {
        const cleanTitle = title.trim();
        const id = headingTextToAutoId(cleanTitle);

        addSymbolAlias(symbolIndex, symbol, { file, id });
        for (const alias of deriveHeadingSymbols(cleanTitle)) {
          addSymbolAlias(symbolIndex, alias, { file, id });
        }

        return `${hashes} ${cleanTitle}`;
      }
    );

    md = md.replace(/<a\s+(?:name|id)="([^"]+)"><\/a>/g, (_m, symbol) => {
      addSymbolAlias(symbolIndex, symbol, {
        file,
        id: headingTextToAutoId(symbol)
      });
      return '';
    });

    md.replace(/^(#{1,6})\s+(.+?)\s*$/gm, (_m, _h, title) => {
      const cleanTitle = title.trim();
      const entry = { file, id: headingTextToAutoId(cleanTitle) };

      for (const alias of deriveHeadingSymbols(cleanTitle)) {
        addSymbolAlias(symbolIndex, alias, entry);
      }

      return _m;
    });

    rewritten.set(file, md);
  }

  for (const [file, md] of rewritten.entries()) {
    await fs.writeFile(file, md, 'utf8');
  }

  return symbolIndex;
}

function rewriteLinks(md, file, symbolIndex) {
  md = md.replace(/\(#([A-Za-z0-9_$.:-]+)\)/g, (_m, frag) => {
    const found = symbolIndex.get(frag);
    return `(#${found ? found.id : headingTextToAutoId(frag)})`;
  });

  md = md.replace(/href="#([A-Za-z0-9_$.:-]+)"/g, (_m, frag) => {
    const found = symbolIndex.get(frag);
    return `href="#${found ? found.id : headingTextToAutoId(frag)}"`;
  });

  md = md.replace(/\]\((?:\.\/|\/)?typedefs\.([A-Za-z0-9_$.:-]+)\)/g, (m, symbol) => {
    const full = `typedefs.${symbol}`;
    const found = symbolIndex.get(full) || symbolIndex.get(symbol);
    if (found) return `](${relDocLink(file, found.file, found.id)})`;
    return m;
  });

  md = md.replace(/\[([^\]]+)\]\((\.\/)?([A-Za-z][A-Za-z0-9_$.:-]*)\)/g, (m, text, _prefix, symbol) => {
    if (
      symbol.includes('/') ||
      symbol.startsWith('http') ||
      symbol.endsWith('.md') ||
      symbol.endsWith('.html')
    ) {
      return m;
    }

    const found = symbolIndex.get(symbol) || symbolIndex.get(`typedefs.${symbol}`);
    if (found) {
      return `[${text}](${relDocLink(file, found.file, found.id)})`;
    }

    const fallback = knownSymbolTarget(symbol);
    if (!fallback) return m;
    if (fallback.startsWith('http')) return `[${text}](${fallback})`;
    return `[${text}](${relDocLink(file, fallback)})`;
  });

  return md;
}

async function postProcessMarkdown() {
  const mdFiles = await walkFiles(docsDir, file => file.endsWith('.md'));
  const symbolIndex = await buildSymbolIndex(mdFiles);

  for (const file of mdFiles) {
    const rel = path.relative(docsDir, file).replace(/\\/g, '/');
    let md = await fs.readFile(file, 'utf8');
    const original = md;

    md = normalizeGuideLinks(md);
    md = rewriteLinks(md, file, symbolIndex);
    if (file.startsWith(apiDir + path.sep)) {
      md = normalizeInlineCodeTags(md);
    }

    if (md !== original) {
      await fs.writeFile(file, md, 'utf8');
    }
  }
}

async function main() {
  try {
    await cleanGeneratedDocs();
    await stageSources();
    await runGenerator();
    await normalizeOutput();
    await postProcessMarkdown();
  } finally {
    await rmrf(stageRoot);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
