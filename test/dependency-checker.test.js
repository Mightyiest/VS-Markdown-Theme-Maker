const test = require('node:test');
const assert = require('node:assert');
const {
  REQUIRED_DEPENDENCIES,
  getDependenciesStatus
} = require('../src/lib/dependency-checker');

test('dependency-checker: REQUIRED_DEPENDENCIES has valid schema and ids', () => {
  assert.strictEqual(REQUIRED_DEPENDENCIES.length, 3);

  const ids = REQUIRED_DEPENDENCIES.map(d => d.id);
  assert.ok(ids.includes('bierner.markdown-mermaid'));
  assert.ok(ids.includes('goessner.mdmath'));
  assert.ok(ids.includes('yzhang.markdown-all-in-one'));

  for (const dep of REQUIRED_DEPENDENCIES) {
    assert.ok(dep.name, `Missing name for ${dep.id}`);
    assert.ok(dep.category, `Missing category for ${dep.id}`);
    assert.ok(dep.description, `Missing description for ${dep.id}`);
  }
});

test('dependency-checker: getDependenciesStatus accurately evaluates installed set', async () => {
  // Test with partial installed set
  const mockSet1 = new Set(['bierner.markdown-mermaid']);
  const status1 = await getDependenciesStatus(mockSet1);

  assert.strictEqual(status1.ok, true);
  assert.strictEqual(status1.installedCount, 1);
  assert.strictEqual(status1.totalCount, 3);
  assert.strictEqual(status1.allInstalled, false);

  const mermaid = status1.items.find(i => i.id === 'bierner.markdown-mermaid');
  assert.strictEqual(mermaid.installed, true);

  const mdmath = status1.items.find(i => i.id === 'goessner.mdmath');
  assert.strictEqual(mdmath.installed, false);

  // Test with all installed
  const mockSet2 = new Set([
    'bierner.markdown-mermaid',
    'goessner.mdmath',
    'yzhang.markdown-all-in-one'
  ]);
  const status2 = await getDependenciesStatus(mockSet2);
  assert.strictEqual(status2.installedCount, 3);
  assert.strictEqual(status2.allInstalled, true);

  // Test case-insensitivity
  const mockSet3 = new Set([
    'BIERNER.MARKDOWN-MERMAID',
    'GOESSNER.MDMATH',
    'YZHANG.MARKDOWN-ALL-IN-ONE'
  ]);
  const status3 = await getDependenciesStatus(new Set(Array.from(mockSet3).map(s => s.toLowerCase())));
  assert.strictEqual(status3.allInstalled, true);
});
