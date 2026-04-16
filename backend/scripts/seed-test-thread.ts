import { upsertTeamsThread } from '../src/db/database.js';
upsertTeamsThread({
  id: 'test-thread-row-1',
  sessionId: 'f9296e54-874c-4cf0-9b2a-06b0e37d39cf',
  teamsThreadId: 'test-thread-99999',
  teamsChannelId: 'test-channel-id',
  currentOutputMessageId: null,
  deltaLink: null,
  createdAt: new Date().toISOString(),
});
console.log('Thread seeded OK');
