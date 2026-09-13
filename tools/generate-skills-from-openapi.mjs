#!/usr/bin/env node
/**
 * scripts/generate-skills-from-openapi.mjs
 *
 * Generate SKILL.md files (one per OpenAPI endpoint) + parent SKILL.md
 * (router with hardcoded child skill names) from any OpenAPI 3.x spec.
 *
 * Usage:
 *   node scripts/generate-skills-from-openapi.mjs <openapi-source> [options]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/generate-skills-from-openapi.mjs <openapi-source> [options]');
  console.log('  --api-name <name>    API name (default: api)');
  console.log('  --output <dir>       Output directory (default: ./generated/<api-name>/)');
  console.log('  --price <micro-usdc> Default price per skill (default: 1000)');
  console.log('  --author-id <0x...>  Author agent ID');
  console.log('  --author-name <name> Author display name');
  console.log('  --max-endpoints <n>  Limit number of endpoints');
  console.log('  --include-tag <tag>  Only include endpoints with this tag');
  console.log('  --exclude-path <regex> Exclude paths matching regex');
  process.exit(0);
}

const SOURCE = args[0];
const OPTIONS = {};
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    OPTIONS[key] = val;
    if (val !== true) i++;
  }
}

const API_NAME = (OPTIONS['api-name'] || 'api').toLowerCase().replace(/[^a-z0-9-]/g, '-');
const PRICE = parseInt(OPTIONS['price'] || '1000', 10);
const AUTHOR_ID = OPTIONS['author-id'] || '0xPLACEHOLDER_REPLACE_WITH_YOUR_AGENT_ID';
const AUTHOR_NAME = OPTIONS['author-name'] || API_NAME;
const OUTPUT_DIR = OPTIONS['output'] || './generated/' + API_NAME;
const MAX_ENDPOINTS = OPTIONS['max-endpoints'] ? parseInt(OPTIONS['max-endpoints'], 10) : Infinity;
const INCLUDE_TAGS = OPTIONS['include-tag'] ? (Array.isArray(OPTIONS['include-tag']) ? OPTIONS['include-tag'] : [OPTIONS['include-tag']]) : null;
const EXCLUDE_PATH = OPTIONS['exclude-path'] ? new RegExp(OPTIONS['exclude-path']) : null;

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
    author_id: AUTHOR_ID,
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

function generateParentSkill(apiName, children) {
  var routing = children.map(function(c) {
    return {
      keywords: extractKeywords(c),
      skill_name: c.name,
      method: c.method,
      path: c.path,
      summary: c.summary,
    };
  });

  var frontmatter = {
    name: apiName + '-all-endpoints',
    description: 'Router for ' + children.length + ' ' + apiName + ' API endpoints. Provide a natural-language task; this skill finds the right endpoint and returns its child skill_name for invocation.',
    version: '1.0.0',
    author_name: AUTHOR_NAME,
    author_id: AUTHOR_ID,
    author_contact: 'support@' + apiName.toLowerCase() + '.example',
    price_usdc: 0,
    is_free: true,
    tags: [apiName.toLowerCase(), 'router', 'meta'],
    openapi_compatible: true,
    mcp_compatible: true,
    runtime: 'any',
  };

  var routingYaml = routing.map(function(r, i) {
    return '  - id: route_' + (i + 1) + '\n' +
      '    skill_name: ' + r.skill_name + '\n' +
      '    keywords: [' + r.keywords.map(function(k) { return '"' + k + '"'; }).join(', ') + ']\n' +
      '    endpoint: ' + r.method + ' ' + r.path + '\n' +
      '    summary: "' + r.summary.replace(/"/g, '\\"').slice(0, 100) + '"';
  }).join('\n');

  var body = [
    '# ' + apiName + '-all-endpoints',
    '',
    'Router for ' + children.length + ' ' + apiName + ' API endpoints.',
    '',
    '## Usage',
    '',
    'Provide a natural-language task. This skill returns the matching child `skill_name` and endpoint.',
    'Then invoke the child skill separately with the required parameters.',
    '',
    '## Inputs',
    '',
    '- `task` (string, required): Natural language description of what you want to do.',
    '',
    '## Output',
    '',
    '- `matched_skill` (string): The child skill_name to invoke.',
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
  };
}

async function main() {
  console.log('\n=== OpenAPI -> SKILL.md Generator ===\n');

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

  var parent = generateParentSkill(API_NAME, children);

  console.log('\n-> Writing to ' + OUTPUT_DIR + '/...');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  var manifest = {
    api_name: API_NAME,
    generated_at: new Date().toISOString(),
    source: SOURCE,
    parent_skill: parent.name,
    child_count: children.length,
    children: children.map(function(c) {
      return {
        filename: c.filename,
        name: c.name,
        method: c.method,
        path: c.path,
        summary: c.summary,
      };
    }),
  };

  var written = 0;
  for (var child of children) {
    writeFileSync(OUTPUT_DIR + '/' + child.filename, child.content);
    written++;
  }
  writeFileSync(OUTPUT_DIR + '/' + parent.filename, parent.content);
  writeFileSync(OUTPUT_DIR + '/manifest.json', JSON.stringify(manifest, null, 2));

  console.log('\n=== Done ===');
  console.log('OK Generated ' + written + ' child SKILLs');
  console.log('OK Generated 1 parent SKILL (' + parent.name + ')');
  console.log('OK Output: ' + OUTPUT_DIR + '/');
  console.log('\nNext steps:');
  console.log('  1. Review files in ' + OUTPUT_DIR + '/');
  console.log('  2. Replace 0xPLACEHOLDER with your agent ID (use --author-id)');
  console.log('  3. Adjust prices per skill if needed');
  console.log('  4. Publish via marketplace (coming soon: --publish flag)');
}

main().catch(function(err) {
  console.error('\nFAIL: ' + err.message);
  console.error(err.stack);
  process.exit(1);
});
