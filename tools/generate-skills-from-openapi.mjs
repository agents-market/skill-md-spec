#!/usr/bin/env node
/**
 * scripts/generate-skills-from-openapi.mjs
 *
 * Phase 1: Generate SKILL.md files (one per OpenAPI endpoint) + parent SKILL.md (router).
 * Phase 2: --publish flag auto-publishes all SKILL.md to marketplace via EIP-191 auth.
 *
 * Usage:
 *   node scripts/generate-skills-from-openapi.mjs <openapi-source> [options]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { Wallet } from 'ethers';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/generate-skills-from-openapi.mjs <openapi-source> [options]');
  console.log('');
  console.log('Generation options:');
  console.log('  --api-name <name>          API name (default: api)');
  console.log('  --output <dir>             Output directory (default: ./generated/<api-name>/)');
  console.log('  --price <micro-usdc>       Default price per skill (default: 1000)');
  console.log('  --author-name <name>       Author display name (default: api-name)');
  console.log('  --max-endpoints <n>        Limit number of endpoints');
  console.log('  --include-tag <tag>        Only include endpoints with this tag');
  console.log('  --exclude-path <regex>     Exclude paths matching regex');
  console.log('');
  console.log('Publishing options:');
  console.log('  --publish                  Auto-publish all generated SKILL.md to marketplace');
  console.log('  --publish-dry-run          Show what would be published, do not actually publish');
  console.log('  --publish-url <url>        Override API base URL (default: env AGENTSMARKET_URL or https://api.agentsmarket.world)');
  console.log('  --batch-size <n>           Concurrent publish requests (default: 5)');
  console.log('  --skip-on-error            Continue on individual publish errors');
  console.log('');
  console.log('Auth: server derives author identity from signature (ecrecover). No --author-id needed.');
  console.log('      Reads private key from ~/.config/agentsmarket/agent.key (created by `agentsmarket init`)');
  console.log('      or AGENTSMARKET_PRIVATE_KEY env var.');
  process.exit(0);
}

const SOURCE = args[0];
const OPTIONS = {};
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    let val;
    if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      val = args[i + 1];
      i++;
    } else {
      val = true;
    }
    OPTIONS[key] = val;
  }
}

const API_NAME = (OPTIONS['api-name'] || 'api').toLowerCase().replace(/[^a-z0-9-]/g, '-');
const PRICE = parseInt(OPTIONS['price'] || '1000', 10);
const AUTHOR_NAME = OPTIONS['author-name'] || API_NAME;
const OUTPUT_DIR = OPTIONS['output'] || './generated/' + API_NAME;
const MAX_ENDPOINTS = OPTIONS['max-endpoints'] ? parseInt(OPTIONS['max-endpoints'], 10) : Infinity;
const INCLUDE_TAGS = OPTIONS['include-tag'] ? (Array.isArray(OPTIONS['include-tag']) ? OPTIONS['include-tag'] : [OPTIONS['include-tag']]) : null;
const EXCLUDE_PATH = OPTIONS['exclude-path'] ? new RegExp(OPTIONS['exclude-path']) : null;
const PUBLISH = !!OPTIONS['publish'];
const PUBLISH_DRY_RUN = !!OPTIONS['publish-dry-run'];
const PUBLISH_URL = (OPTIONS['publish-url'] || process.env.AGENTSMARKET_URL || 'https://api.agentsmarket.world').replace(/\/$/, '');
const BATCH_SIZE = parseInt(OPTIONS['batch-size'] || '5', 10);
const SKIP_ON_ERROR = !!OPTIONS['skip-on-error'];

// Resolved at runtime: placeholder for file-only generation, real address for publishing.
let RESOLVED_AUTHOR_ID = '0xPLACEHOLDER_REPLACE_WITH_YOUR_AGENT_ID';

// --- OpenAPI loading ---

async function loadSpec(source) {
  let text;
  if (source.startsWith('http://') || source.startsWith('https://')) {
    console.log('-> Fetching ' + source + '...');
    const res = await fetch(source);
    if (!res.ok) throw new Error('Failed to fetch ' + source + ': ' + res.status);
    text = await res.text();
  } else {
    console.log('-> Reading ' + source + '...');
    text = readFileSync(source, 'utf-8');
  }
  const isYaml = source.endsWith('.yaml') || source.endsWith('.yml') || source.includes('yaml');
  return isYaml ? yaml.load(text) : JSON.parse(text);
}

// --- Frontmatter helpers ---

function formatParams(params) {
  if (params.length === 0) return 'No parameters.';
  return params.map(function(p) {
    var required = p.required ? ' **(required)**' : '';
    var type = (p.schema && p.schema.type) || ((p.schema && p.schema['$ref']) ? p.schema['$ref'].split('/').pop() : null) || 'any';
    return '- `' + p.name + '` (' + type + ')' + required + ' — ' + (p.description || '');
  }).join('\n');
}

function formatRequestBody(rb) {
  if (!rb.content) return 'No request body.';
  var schemas = Object.keys(rb.content);
  if (schemas.length === 0) return 'No request body schema.';
  return 'Content-Type: `' + schemas[0] + '`\n\nSee OpenAPI spec for schema.';
}

function formatResponses(responses) {
  var codes = Object.keys(responses);
  if (codes.length === 0) return 'No response defined.';
  return codes.map(function(c) { return '- **' + c + '**: ' + (responses[c].description || ''); }).join('\n');
}

// --- Child SKILL.md generation ---

function generateChildSkill(apiName, path, method, operation) {
  var opId = operation.operationId || (method + '_' + path.replace(/[^a-zA-Z0-9]/g, '_'));
  var name = (apiName + '-' + opId).toLowerCase().slice(0, 80)
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  var summary = operation.summary || (method.toUpperCase() + ' ' + path);
  var description = (operation.description || summary).slice(0, 200);
  var tags = (operation.tags || [apiName]).map(function(t) { return t.toLowerCase(); });

  var frontmatter = {
    name: name,
    description: description,
    version: '1.0.0',
    author_name: AUTHOR_NAME,
    author_id: RESOLVED_AUTHOR_ID,
    author_contact: 'support@' + apiName.toLowerCase() + '.example',
    price_usdc: PRICE,
    is_free: PRICE === 0,
    tags: tags,
    openapi_compatible: true,
    mcp_compatible: false,
    runtime: 'any',
  };

  var body = [
    '# ' + name,
    '',
    description,
    '',
    '## API Endpoint',
    '',
    '**' + method.toUpperCase() + '** `' + path + '`',
    '',
    '## Parameters',
    '',
    formatParams(operation.parameters || []),
    '',
    '## Request Body',
    '',
    operation.requestBody ? formatRequestBody(operation.requestBody) : 'No request body.',
    '',
    '## Response',
    '',
    operation.responses ? formatResponses(operation.responses) : 'See OpenAPI spec for response schema.',
    '',
    '## Authentication',
    '',
    'Requires authentication per ' + apiName + ' API conventions. See OpenAPI spec for security schemes.',
    '',
    '## Source',
    '',
    'Generated from OpenAPI spec. Endpoint: `' + method.toUpperCase() + ' ' + path + '`.',
    'For canonical spec, see the OpenAPI source.',
  ].join('\n');

  return {
    filename: name + '.md',
    content: '---\n' + yaml.dump(frontmatter, { lineWidth: 120 }) + '---\n\n' + body + '\n',
    name: name,
    summary: summary,
    description: description,
    tags: tags,
    method: method.toUpperCase(),
    path: path,
  };
}

function extractKeywords(child) {
  var keywords = new Set();
  child.tags.forEach(function(tag) { keywords.add(tag); });
  var lastPart = child.name.split('-').pop() || '';
  lastPart.split(/_|(?=[A-Z])/).filter(Boolean).forEach(function(w) { keywords.add(w.toLowerCase()); });
  child.summary.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; }).slice(0, 5).forEach(function(w) { keywords.add(w); });
  child.path.split('/').filter(Boolean).forEach(function(p) {
    if (!p.startsWith('{') && !p.startsWith('$')) keywords.add(p.toLowerCase());
  });
  return Array.from(keywords).slice(0, 10);
}

// --- Parent SKILL.md generation (now accepts optional childIds map) ---

function generateParentSkill(apiName, children, childIds) {
  childIds = childIds || new Map();

  var routing = children.map(function(c) {
    var route = {
      keywords: extractKeywords(c),
      skill_name: c.name,
      method: c.method,
      path: c.path,
      summary: c.summary,
    };
    if (childIds.has(c.name)) route.skill_id = childIds.get(c.name);
    return route;
  });

  var frontmatter = {
    name: apiName + '-all-endpoints',
    description: 'Router for ' + children.length + ' ' + apiName + ' API endpoints. Provide a natural-language task; this skill finds the right endpoint and returns its child skill_name + skill_id for invocation.',
    version: '1.0.0',
    author_name: AUTHOR_NAME,
    author_id: RESOLVED_AUTHOR_ID,
    author_contact: 'support@' + apiName.toLowerCase() + '.example',
    price_usdc: 0,
    is_free: true,
    tags: [apiName.toLowerCase(), 'router', 'meta'],
    openapi_compatible: true,
    mcp_compatible: true,
    runtime: 'any',
  };

  var routingYaml = routing.map(function(r, i) {
    var lines = [];
    lines.push('  - id: route_' + (i + 1));
    lines.push('    skill_name: ' + r.skill_name);
    if (r.skill_id) lines.push('    skill_id: ' + r.skill_id);
    lines.push('    keywords: [' + r.keywords.map(function(k) { return '"' + k + '"'; }).join(', ') + ']');
    lines.push('    endpoint: ' + r.method + ' ' + r.path);
    lines.push('    summary: "' + r.summary.replace(/"/g, '\\"').slice(0, 100) + '"');
    return lines.join('\n');
  }).join('\n');

  var body = [
    '# ' + apiName + '-all-endpoints',
    '',
    'Router for ' + children.length + ' ' + apiName + ' API endpoints.',
    '',
    '## Usage',
    '',
    'Provide a natural-language task. This skill returns the matching child `skill_name` (and `skill_id` when available).',
    'Then invoke the child skill separately with the required parameters.',
    '',
    '## Inputs',
    '',
    '- `task` (string, required): Natural language description of what you want to do.',
    '',
    '## Output',
    '',
    '- `matched_skill_name` (string): The child skill_name to invoke.',
    '- `matched_skill_id` (string, optional): The child skill_id (when published via --publish).',
    '- `endpoint` (string): The HTTP endpoint (`METHOD /path`).',
    '- `confidence` (string): "exact", "partial", or "none".',
    '',
    '## Routing',
    '',
    '```yaml',
    'routes:',
    routingYaml,
    '```',
    '',
    '## Note',
    '',
    'This parent skill does NOT execute the API call itself. It only identifies which child skill should be invoked. The agent then calls the child skill separately with the required parameters.',
    '',
    'For simple use, prefer the individual child skills directly.',
    '',
    'Generated from OpenAPI spec. ' + children.length + ' endpoints indexed.',
  ].join('\n');

  return {
    filename: '_parent_' + apiName + '-all-endpoints.md',
    content: '---\n' + yaml.dump(frontmatter, { lineWidth: 120 }) + '---\n\n' + body + '\n',
    name: apiName + '-all-endpoints',
    routing: routing,
    tags: [apiName.toLowerCase(), 'router', 'meta'],
    description: frontmatter.description,
  };
}

// --- EIP-191 signing via ethers (same lib server uses for ecrecover — guaranteed compat) ---

async function signEip191(privateKeyHex, message) {
  const wallet = new Wallet(privateKeyHex.startsWith('0x') ? privateKeyHex : '0x' + privateKeyHex);
  return await wallet.signMessage(message);
}

function addressFromPrivateKey(privateKeyHex) {
  const wallet = new Wallet(privateKeyHex.startsWith('0x') ? privateKeyHex : '0x' + privateKeyHex);
  return wallet.address;
}

function getPrivateKey() {
  if (process.env.AGENTSMARKET_PRIVATE_KEY) {
    return process.env.AGENTSMARKET_PRIVATE_KEY;
  }
  const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const keyPath = path.join(configDir, 'agentsmarket', 'agent.key');
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, 'utf-8').trim();
  }
  return null;
}

// Replace author_id line in YAML frontmatter (handles quoted and unquoted forms).
function replaceAuthorId(content, newAuthorId) {
  return content.replace(/^author_id:.*$/m, `author_id: '${newAuthorId}'`);
}

// --- Authenticated publish ---

async function publishSkill(baseUrl, privateKeyHex, body) {
  const path = '/v1/skills';
  const bodyStr = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
  const message = `POST\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = await signEip191(privateKeyHex, message);

  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed.code ? `${parsed.code}: ${parsed.error}` : errMsg;
      if (parsed.detail) errMsg += ` (${parsed.detail})`;
    } catch {
      errMsg += ': ' + errText.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  return await res.json();
}

function printProgress(done, total, name) {
  const pct = (done / total * 100).toFixed(1);
  const filled = Math.round(done / total * 30);
  const bar = '█'.repeat(filled) + '░'.repeat(30 - filled);
  process.stdout.write(`\r  [${bar}] ${done}/${total} (${pct}%)  ${name.slice(0, 40)}`);
}

async function publishBatch(baseUrl, privateKeyHex, items, batchSize, skipOnError) {
  const results = new Map();
  const errors = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const promises = batch.map(async (item) => {
      try {
        const result = await publishSkill(baseUrl, privateKeyHex, item.body);
        return { name: item.name, ok: true, id: result.id };
      } catch (err) {
        return { name: item.name, ok: false, error: err.message };
      }
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r.ok) {
        results.set(r.name, r.id);
      } else {
        errors.push(r);
        if (!skipOnError) {
          process.stdout.write('\n');
          throw new Error(`Failed to publish ${r.name}: ${r.error}`);
        }
      }
    }

    printProgress(Math.min(i + batchSize, items.length), items.length, batch[batch.length - 1].name);
  }

  process.stdout.write('\n');
  return { results, errors };
}

// --- Main flow ---

async function main() {
  console.log('\n=== OpenAPI -> SKILL.md Generator (Phase 2) ===\n');

  if (PUBLISH_DRY_RUN) {
    console.log('[DRY RUN MODE — no actual publishing]\n');
  }

  var spec = await loadSpec(SOURCE);
  console.log('OK Loaded spec: ' + (spec.openapi || spec.swagger || 'unknown version'));

  if (!spec.paths) {
    throw new Error('No paths found in OpenAPI spec');
  }

  var operations = [];
  for (var pathKey of Object.keys(spec.paths)) {
    var pathItem = spec.paths[pathKey];
    for (var method of ['get', 'post', 'put', 'patch', 'delete']) {
      var operation = pathItem[method];
      if (!operation) continue;
      if (INCLUDE_TAGS && (!operation.tags || !operation.tags.some(function(t) { return INCLUDE_TAGS.includes(t); }))) continue;
      if (EXCLUDE_PATH && EXCLUDE_PATH.test(pathKey)) continue;
      operations.push({ path: pathKey, method: method, operation: operation });
    }
  }

  if (operations.length === 0) throw new Error('No operations matched filters');

  console.log('OK Found ' + operations.length + ' operations' + (INCLUDE_TAGS ? ' (filtered by tags: ' + INCLUDE_TAGS.join(', ') + ')' : ''));

  if (operations.length > MAX_ENDPOINTS) {
    console.log('  Limiting to first ' + MAX_ENDPOINTS + ' (--max-endpoints)');
    operations.length = MAX_ENDPOINTS;
  }

  var children = operations.map(function(o) {
    return generateChildSkill(API_NAME, o.path, o.method, o.operation);
  });

  // Write children to disk (always, even in publish mode — useful for local archive)
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (var child of children) {
    writeFileSync(OUTPUT_DIR + '/' + child.filename, child.content);
  }
  // Initial parent (without IDs)
  var parent = generateParentSkill(API_NAME, children);
  writeFileSync(OUTPUT_DIR + '/' + parent.filename, parent.content);

  console.log('\n-> Generated ' + children.length + ' child + 1 parent SKILL.md to ' + OUTPUT_DIR + '/');

  if (PUBLISH_DRY_RUN) {
    console.log('\n=== DRY RUN SUMMARY ===');
    console.log('Would publish to: ' + PUBLISH_URL);
    console.log('Author:            ' + RESOLVED_AUTHOR_ID + ' (' + AUTHOR_NAME + ')');
    console.log('Children:          ' + children.length + ' (price: ' + PRICE + ' micro-USDC each)');
    console.log('Parent:            1 (price: 0, free)');
    console.log('Batch size:        ' + BATCH_SIZE + ' concurrent');
    console.log('Skip on error:     ' + SKIP_ON_ERROR);
    process.exit(0);
  }

  if (!PUBLISH) {
    console.log('\nNext steps:');
    console.log('  1. Review files in ' + OUTPUT_DIR + '/');
    console.log('  2. Run with --publish-dry-run to preview publishing');
    console.log('  3. Run with --publish to auto-publish to marketplace');
    process.exit(0);
  }

  // ===== Publishing flow =====
  console.log('\n=== Auto-publish mode ===\n');

  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error(
      'Cannot publish: no private key found.\n' +
      '  Option A: run `agentsmarket init` first (creates ~/.config/agentsmarket/agent.key)\n' +
      '  Option B: set AGENTSMARKET_PRIVATE_KEY env var'
    );
  }

  // Derive author identity from private key — server uses ecrecover(signature)
  // and would ignore any author_id we send in the body. We derive for:
  //   1. Real address in frontmatter (so agents see who owns the SKILL)
  //   2. Manifest accuracy
  RESOLVED_AUTHOR_ID = addressFromPrivateKey(privateKey);

  // Regenerate all SKILL.md content with real author_id, overwrite on disk
  for (const child of children) {
    child.content = replaceAuthorId(child.content, RESOLVED_AUTHOR_ID);
    writeFileSync(OUTPUT_DIR + '/' + child.filename, child.content);
  }
  var parent = generateParentSkill(API_NAME, children);
  writeFileSync(OUTPUT_DIR + '/' + parent.filename, parent.content);

  console.log('Author:  ' + RESOLVED_AUTHOR_ID);
  console.log('URL:     ' + PUBLISH_URL);
  console.log('Price:   ' + PRICE + ' micro-USDC per child');
  console.log('Batch:   ' + BATCH_SIZE + ' concurrent');
  console.log('');

  // 1. Publish children
  const childItems = children.map(c => ({
    name: c.name,
    body: {
      name: c.name,
      description: c.description,
      price_usdc: PRICE,
      tags: c.tags,
      public_md: c.summary.slice(0, 500),
      full_md: c.content,
    },
  }));

  console.log('Publishing ' + childItems.length + ' children...');
  const { results: childIds, errors: childErrors } = await publishBatch(
    PUBLISH_URL, privateKey, childItems, BATCH_SIZE, SKIP_ON_ERROR
  );

  if (childErrors.length > 0) {
    console.log('\n⚠ ' + childErrors.length + ' children failed:');
    childErrors.slice(0, 10).forEach(e => console.log('  - ' + e.name + ': ' + e.error.slice(0, 100)));
    if (childErrors.length > 10) console.log('  ... and ' + (childErrors.length - 10) + ' more');
  }

  console.log('OK ' + childIds.size + '/' + children.length + ' children published');

  // 2. Regenerate parent with real IDs and overwrite
  var parentWithIds = generateParentSkill(API_NAME, children, childIds);
  writeFileSync(OUTPUT_DIR + '/' + parentWithIds.filename, parentWithIds.content);

  // 3. Publish parent
  console.log('\nPublishing parent...');
  const parentBody = {
    name: parentWithIds.name,
    description: parentWithIds.description,
    price_usdc: 0,
    tags: parentWithIds.tags,
    public_md: 'Router for ' + children.length + ' ' + API_NAME + ' API endpoints. ' + childIds.size + ' children indexed with real IDs.',
    full_md: parentWithIds.content,
  };

  let parentResult;
  try {
    parentResult = await publishSkill(PUBLISH_URL, privateKey, parentBody);
    console.log('OK Parent published: ' + parentResult.id + ' (' + parentResult.name + ')');
  } catch (err) {
    console.error('FAIL Parent publish failed: ' + err.message);
    if (!SKIP_ON_ERROR) throw err;
  }

  // 4. Save manifest with all IDs
  const manifest = {
    api_name: API_NAME,
    generated_at: new Date().toISOString(),
    source: SOURCE,
    published_at: new Date().toISOString(),
    publish_url: PUBLISH_URL,
    author_id: RESOLVED_AUTHOR_ID,
    author_name: AUTHOR_NAME,
    parent_skill: {
      name: parentWithIds.name,
      id: parentResult?.id || null,
    },
    child_count: children.length,
    children_published: childIds.size,
    children: children.map(c => ({
      filename: c.filename,
      name: c.name,
      id: childIds.get(c.name) || null,
      method: c.method,
      path: c.path,
      summary: c.summary,
    })),
    errors: childErrors,
  };
  writeFileSync(OUTPUT_DIR + '/manifest.json', JSON.stringify(manifest, null, 2));

  console.log('\n=== Done ===');
  console.log('OK ' + childIds.size + ' children + 1 parent published');
  console.log('OK Parent ID: ' + (parentResult?.id || '(failed)'));
  console.log('OK Manifest saved to ' + OUTPUT_DIR + '/manifest.json');
  if (parentResult?.id) {
    console.log('\nView parent at: https://agentsmarket.world/skills/' + parentResult.id);
  }
}

main().catch(function(err) {
  console.error('\nFAIL: ' + err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
