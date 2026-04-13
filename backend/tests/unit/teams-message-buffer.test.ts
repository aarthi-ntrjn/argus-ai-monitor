import { describe, it, expect } from 'vitest';
import { TeamsMessageBuffer } from '../../src/services/teams-message-buffer.js';

describe('TeamsMessageBuffer', () => {
  it('enqueue/flush preserves order', () => {
    const buf = new TeamsMessageBuffer();
    buf.enqueue('s1', 'a');
    buf.enqueue('s1', 'b');
    buf.enqueue('s1', 'c');
    expect(buf.flush('s1')).toEqual(['a', 'b', 'c']);
  });

  it('flush clears buffer', () => {
    const buf = new TeamsMessageBuffer();
    buf.enqueue('s1', 'x');
    buf.flush('s1');
    expect(buf.flush('s1')).toEqual([]);
  });

  it('size returns correct count', () => {
    const buf = new TeamsMessageBuffer();
    buf.enqueue('s1', 'a');
    buf.enqueue('s1', 'b');
    expect(buf.size('s1')).toBe(2);
  });

  it('enqueue at cap evicts oldest and increments droppedCount', () => {
    const buf = new TeamsMessageBuffer(2);
    buf.enqueue('s1', 'a');
    buf.enqueue('s1', 'b');
    buf.enqueue('s1', 'c'); // evicts 'a'
    expect(buf.flush('s1')).toEqual(['b', 'c']);
    expect(buf.droppedCount('s1')).toBe(1);
  });

  it('clear removes all entries', () => {
    const buf = new TeamsMessageBuffer();
    buf.enqueue('s1', 'x');
    buf.clear('s1');
    expect(buf.size('s1')).toBe(0);
    expect(buf.droppedCount('s1')).toBe(0);
  });
});
