import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';

describe('Todos API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = ':memory:';
    closeDb();
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  beforeEach(async () => {
    // Clean todos between tests
    const todos = (await request.get('/api/v1/todos')).body as Array<{ id: string }>;
    for (const t of todos) {
      await request.delete(`/api/v1/todos/${t.id}`);
    }
  });

  // TC-001: Returns empty array when no todos exist
  describe('GET /api/v1/todos', () => {
    it('TC-001: returns empty array when no todos exist', async () => {
      const res = await request.get('/api/v1/todos');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('TC-002: returns all todos ordered by created_at ascending', async () => {
      await request.post('/api/v1/todos').send({ text: 'First' });
      await request.post('/api/v1/todos').send({ text: 'Second' });
      const res = await request.get('/api/v1/todos');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].text).toBe('First');
      expect(res.body[1].text).toBe('Second');
    });
  });

  // TC-003 to TC-006: POST /api/v1/todos
  describe('POST /api/v1/todos', () => {
    it('TC-003: creates item and returns 201 with full TodoItem shape', async () => {
      const res = await request.post('/api/v1/todos').send({ text: 'Fix the bug' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.text).toBe('Fix the bug');
      expect(res.body.done).toBe(false);
      expect(res.body.userId).toBe('default');
      expect(res.body.createdAt).toBeTruthy();
      expect(res.body.updatedAt).toBeTruthy();
    });

    it('TC-004: returns 400 for empty text', async () => {
      const res = await request.post('/api/v1/todos').send({ text: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toBeTruthy();
      expect(res.body.requestId).toBeTruthy();
    });

    it('TC-005: returns 400 for whitespace-only text', async () => {
      const res = await request.post('/api/v1/todos').send({ text: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('TC-006: returns 400 when text exceeds 500 characters', async () => {
      const res = await request.post('/api/v1/todos').send({ text: 'a'.repeat(501) });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // TC-007 to TC-010: PATCH /api/v1/todos/:id
  describe('PATCH /api/v1/todos/:id', () => {
    it('TC-007: marks item as done and updates updatedAt', async () => {
      const created = (await request.post('/api/v1/todos').send({ text: 'Task A' })).body;
      const res = await request.patch(`/api/v1/todos/${created.id}`).send({ done: true });
      expect(res.status).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.updatedAt).not.toBe(created.updatedAt);
    });

    it('TC-008: marks item as not-done (toggle back)', async () => {
      const created = (await request.post('/api/v1/todos').send({ text: 'Task B' })).body;
      await request.patch(`/api/v1/todos/${created.id}`).send({ done: true });
      const res = await request.patch(`/api/v1/todos/${created.id}`).send({ done: false });
      expect(res.status).toBe(200);
      expect(res.body.done).toBe(false);
    });

    it('TC-009: returns 404 for unknown id', async () => {
      const res = await request.patch('/api/v1/todos/nonexistent-id').send({ done: true });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('TC-010: returns 400 for missing done field', async () => {
      const created = (await request.post('/api/v1/todos').send({ text: 'Task C' })).body;
      const res = await request.patch(`/api/v1/todos/${created.id}`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // TC-011 to TC-012: DELETE /api/v1/todos/:id
  describe('DELETE /api/v1/todos/:id', () => {
    it('TC-011: deletes item and returns 204', async () => {
      const created = (await request.post('/api/v1/todos').send({ text: 'To delete' })).body;
      const res = await request.delete(`/api/v1/todos/${created.id}`);
      expect(res.status).toBe(204);
      const list = await request.get('/api/v1/todos');
      expect(list.body.find((t: { id: string }) => t.id === created.id)).toBeUndefined();
    });

    it('TC-012: returns 404 for unknown id', async () => {
      const res = await request.delete('/api/v1/todos/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  // TC-013 to TC-014: PATCH text update
  describe('PATCH /api/v1/todos/:id — text update', () => {
    it('TC-013: updates text and returns 200 with done unchanged', async () => {
      const created = (await request.post('/api/v1/todos').send({ text: 'Original text' })).body;
      const res = await request.patch(`/api/v1/todos/${created.id}`).send({ text: 'Updated text' });
      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated text');
      expect(res.body.done).toBe(false);
      expect(res.body.updatedAt).not.toBe(created.updatedAt);
    });

    it('TC-014: returns 400 for empty text string', async () => {
      const created = (await request.post('/api/v1/todos').send({ text: 'Some task' })).body;
      const res = await request.patch(`/api/v1/todos/${created.id}`).send({ text: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
