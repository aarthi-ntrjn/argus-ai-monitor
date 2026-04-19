import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';

// Use an in-memory DB for each test by overriding ARGUS_DB_PATH
beforeEach(() => {
  process.env.ARGUS_DB_PATH = ':memory:';
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db/database.js');
  closeDb();
  delete process.env.ARGUS_DB_PATH;
});

describe('repository path normalization', () => {
  it('finds a repo inserted with trailing slash when looked up without', async () => {
    const { insertRepository, getRepositoryByPath } = await import('../../src/db/database.js');
    const id = randomUUID();
    insertRepository({ id, path: '/home/user/project/', name: 'project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null, branch: null, remoteUrl: null });
    const found = getRepositoryByPath('/home/user/project');
    expect(found).toBeDefined();
    expect(found!.id).toBe(id);
  });

  it('finds a repo inserted without trailing slash when looked up with one', async () => {
    const { insertRepository, getRepositoryByPath } = await import('../../src/db/database.js');
    const id = randomUUID();
    insertRepository({ id, path: '/home/user/project', name: 'project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null, branch: null, remoteUrl: null });
    const found = getRepositoryByPath('/home/user/project/');
    expect(found).toBeDefined();
    expect(found!.id).toBe(id);
  });

  it('finds a repo inserted with multiple trailing slashes', async () => {
    const { insertRepository, getRepositoryByPath } = await import('../../src/db/database.js');
    const id = randomUUID();
    insertRepository({ id, path: '/home/user/project///', name: 'project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null, branch: null, remoteUrl: null });
    const found = getRepositoryByPath('/home/user/project');
    expect(found).toBeDefined();
    expect(found!.id).toBe(id);
  });

  it('is case-insensitive', async () => {
    const { insertRepository, getRepositoryByPath } = await import('../../src/db/database.js');
    const id = randomUUID();
    insertRepository({ id, path: 'C:\\Users\\Dev\\Project', name: 'Project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null, branch: null, remoteUrl: null });
    const found = getRepositoryByPath('C:\\Users\\Dev\\project');
    expect(found).toBeDefined();
    expect(found!.id).toBe(id);
  });
});
