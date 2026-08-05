const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { recordProjectInstallation, getProjectInstallationRecord, listInstalledProjects, removeProjectRecord } = require('../src/lib/project-registry');

test('project-registry: records, retrieves, lists and removes project theme installations', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-reg-test-'));
  const userDataPath = path.join(tmpDir, 'userData');
  const projectPath = path.join(tmpDir, 'sample-project');

  fs.mkdirSync(projectPath, { recursive: true });

  const themeData = {
    themeId: 'custom-12345',
    themeName: 'My Purple Dark',
    baseThemeId: 'midnight-dark',
    tokens: { bgBody: '#1e1e3a', textBody: '#ffffff' }
  };

  // 1. Record installation
  const result = recordProjectInstallation(userDataPath, projectPath, themeData);
  assert.equal(result.ok, true);
  assert.equal(result.record.themeId, 'custom-12345');

  // 2. Retrieve from app registry
  const record = getProjectInstallationRecord(userDataPath, projectPath);
  assert.notEqual(record, null);
  assert.equal(record.themeName, 'My Purple Dark');
  assert.equal(record.tokens.bgBody, '#1e1e3a');

  // 3. List installed projects
  const projects = listInstalledProjects(userDataPath);
  assert.equal(projects.length, 1);

  // 4. Remove project record
  removeProjectRecord(userDataPath, projectPath);
  const projectsAfter = listInstalledProjects(userDataPath);
  assert.equal(projectsAfter.length, 0);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
