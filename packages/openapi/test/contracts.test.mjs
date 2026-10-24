import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('spec export needs no runtime dependencies and rejects stale artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-spec-'));
  try {
    const source = JSON.parse(await readFile('openapi.json', 'utf8'));
    source.info.title = 'Stale contract';
    const target = join(directory, 'openapi.json');
    await writeFile(target, JSON.stringify(source));
    const env = { ...process.env };
    for (const name of [
      'DATABASE_URL',
      'DATABASE_URL_UNPOOLED',
      'REDIS_URL',
      'JWT_SECRET',
      'AUTH_SECRET',
      'AUTH_ALLOWED_ORIGINS',
      'AUTH_ALLOW_INSECURE_HTTP',
    ])
      delete env[name];
    env.FLOWBOARD_NETWORK_ATTEMPTS = join(directory, 'network-attempts');
    env.NODE_OPTIONS = `--import=${new URL('./fixtures/block-network.mjs', import.meta.url).href}`;
    const valid = spawnSync(process.execPath, ['scripts/export.mjs', '--check'], {
      encoding: 'utf8',
      env,
      timeout: 60_000,
    });
    assert.equal(valid.error, undefined);
    assert.equal(valid.status, 0, valid.stderr);
    assert.deepEqual(await readdir(directory), ['openapi.json']);
    const drift = spawnSync(
      process.execPath,
      ['scripts/export.mjs', '--check', `--target=${target}`],
      { encoding: 'utf8', env, timeout: 60_000 },
    );
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /OpenAPI drift detected/);
    assert.deepEqual(await readdir(directory), ['openapi.json']);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('Spectral rejects unversioned paths, missing IDs, offset paging and untyped errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-spectral-'));
  try {
    const document = JSON.parse(await readFile('openapi.json', 'utf8'));
    document.paths['/tasks'] = {
      get: {
        ...document.paths['/health/live'].get,
        operationId: 'listTasks',
        parameters: [{ in: 'query', name: 'offset', schema: { type: 'integer' } }],
      },
    };
    delete document.paths['/health/ready'].get.operationId;
    delete document.paths['/health/live'].get.description;
    document.paths['/health/ready'].get.responses['503'] = { description: 'Missing error schema' };
    const target = join(directory, 'invalid.json');
    await writeFile(target, JSON.stringify(document));
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/@stoplight/spectral-cli/dist/index.js',
        'lint',
        target,
        '--ruleset',
        '.spectral.yaml',
        '--format',
        'json',
      ],
      { encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(result.status, 1, result.stderr);
    const codes = JSON.parse(result.stdout).map((finding) => finding.code);
    for (const code of [
      'flowboard-versioned-paths',
      'operation-operationId',
      'operation-description',
      'flowboard-list-cursor',
      'flowboard-cursor-only',
      'flowboard-error-envelope',
    ])
      assert.ok(codes.includes(code), code);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

for (const [name, mutate, code] of [
  [
    'missing cursor',
    (doc) => {
      const op = doc.paths['/v1/tree'].get;
      op.parameters = op.parameters.filter((parameter) => parameter.name !== 'cursor');
    },
    'flowboard-list-cursor',
  ],
  [
    'missing limit',
    (doc) => {
      const op = doc.paths['/v1/tree'].get;
      op.parameters = op.parameters.filter((parameter) => parameter.name !== 'limit');
    },
    'flowboard-list-cursor',
  ],
  [
    'unbounded limit',
    (doc) => {
      delete doc.paths['/v1/tree'].get.parameters.find((parameter) => parameter.name === 'limit')
        .schema.pattern;
    },
    'flowboard-list-cursor',
  ],
  [
    'missing page wrapper',
    (doc) => {
      doc.paths['/v1/tree'].get.responses['200'].content['application/json'].schema = {
        type: 'array',
        items: { type: 'string' },
      };
    },
    'flowboard-list-cursor',
  ],
  [
    'optional pageInfo',
    (doc) => {
      const schema = doc.components.schemas.TreePageResponseDto_Output;
      schema.required = schema.required.filter((name) => name !== 'pageInfo');
    },
    'flowboard-list-cursor',
  ],
  [
    'untyped page items',
    (doc) => {
      doc.components.schemas.TreePageResponseDto_Output.properties.items.items = {};
    },
    'flowboard-list-cursor',
  ],
  [
    'untyped item alternatives',
    (doc) => {
      doc.components.schemas.TreePageResponseDto_Output.properties.items.items = { anyOf: [{}] };
    },
    'flowboard-list-cursor',
  ],
  [
    'duplicate operation IDs',
    (doc) => {
      doc.paths['/health/ready'].get.operationId = doc.paths['/health/live'].get.operationId;
    },
    'operation-operationId-unique',
  ],
]) {
  test(`Spectral rejects ${name} independently`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flowboard-rule-'));
    try {
      const document = JSON.parse(await readFile('openapi.json', 'utf8'));
      mutate(document);
      const target = join(directory, 'invalid.json');
      await writeFile(target, JSON.stringify(document));
      const result = spawnSync(
        process.execPath,
        [
          'node_modules/@stoplight/spectral-cli/dist/index.js',
          'lint',
          target,
          '--ruleset',
          '.spectral.yaml',
          '--format',
          'json',
        ],
        { encoding: 'utf8', timeout: 30_000 },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.ok(
        JSON.parse(result.stdout).some((finding) => finding.code === code),
        result.stdout,
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}

test('normal build and explicit checks validate the freshly generated spec', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(manifest.scripts.build, /node scripts\/check\.mjs/);
  assert.equal(manifest.scripts['openapi:check'], 'node scripts/check.mjs');
});

test('temporary regeneration cleans up and preserves targets after schema drift', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-drift-'));
  try {
    const committed = await readFile('openapi.json');
    const document = JSON.parse(committed);
    document.components.schemas.CreateTaskDto.properties.title.maxLength = 499;
    const target = join(directory, 'expected.json');
    const stale = JSON.stringify(document, null, 2) + '\n';
    await writeFile(target, stale);
    const result = spawnSync(process.execPath, ['scripts/check.mjs', `--target=${target}`], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, TMPDIR: directory },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /OpenAPI drift detected/);
    assert.equal(await readFile(target, 'utf8'), stale);
    assert.deepEqual(await readFile('openapi.json'), committed);
    assert.deepEqual(await readdir(directory), ['expected.json']);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('successful temporary checks leave the committed document and temp directory unchanged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-clean-check-'));
  try {
    const committed = await readFile('openapi.json');
    const result = spawnSync(process.execPath, ['scripts/check.mjs'], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, TMPDIR: directory },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readFile('openapi.json'), committed);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('network guard detects both outgoing connections and listening sockets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-network-guard-'));
  try {
    const attempts = join(directory, 'attempts');
    for (const source of [
      "import('node:net').then(net => net.createConnection({port: 9}))",
      "import('node:net').then(net => net.createServer().listen(0))",
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          new URL('./fixtures/block-network.mjs', import.meta.url).href,
          '--eval',
          source,
        ],
        {
          encoding: 'utf8',
          timeout: 10_000,
          env: { ...process.env, FLOWBOARD_NETWORK_ATTEMPTS: attempts },
        },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Spec export attempted network access/);
    }
    assert.equal(await readFile(attempts, 'utf8'), 'attempt\nattempt\n');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('a freshly generated invalid spec fails lint and cleans temporary files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-invalid-export-'));
  try {
    const committed = await readFile('openapi.json');
    const target = join(directory, 'expected.json');
    await writeFile(target, committed);
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        new URL('./fixtures/invalid-spec.mjs', import.meta.url).href,
        'scripts/check.mjs',
        `--target=${target}`,
      ],
      {
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, FLOWBOARD_INVALID_SPEC: target, TMPDIR: directory },
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /operation-operationId/);
    assert.deepEqual(await readFile(target), committed);
    assert.deepEqual(await readFile('openapi.json'), committed);
    assert.deepEqual(await readdir(directory), ['expected.json']);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
