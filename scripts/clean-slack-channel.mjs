#!/usr/bin/env node
/**
 * Deletes all messages posted by the Argus bot in a Slack channel and resets
 * the Slack thread anchors in the Argus database so the next server start
 * creates fresh threads.
 *
 * Credentials are read from (in priority order):
 *   1. SLACK_BOT_TOKEN / SLACK_CHANNEL_ID environment variables
 *   2. ~/.argus/config.json  (same source as the Argus server)
 *
 * Usage:
 *   node scripts/clean-slack-channel.mjs [--dry-run] [--channel <channelId>]
 *
 * Flags:
 *   --dry-run          Print what would be deleted without actually deleting.
 *   --channel <id>     Override the channel ID from config/env.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
import { WebClient } from '@slack/web-api';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const channelOverride = (() => {
  const idx = args.indexOf('--channel');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Load config
// ---------------------------------------------------------------------------

function loadSlackCredentials() {
  let fileCfg = {};
  const configPath = process.env.ARGUS_CONFIG_PATH ?? join(homedir(), '.argus', 'config.json');
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    fileCfg = raw.slack ?? {};
  } catch { /* not present — fall through to env vars */ }

  return {
    botToken: process.env.SLACK_BOT_TOKEN ?? fileCfg.botToken ?? '',
    channelId: channelOverride ?? process.env.SLACK_CHANNEL_ID ?? fileCfg.channelId ?? '',
  };
}

const { botToken, channelId } = loadSlackCredentials();

if (!botToken) {
  console.error('Error: SLACK_BOT_TOKEN not set (env var or ~/.argus/config.json slack.botToken).');
  process.exit(1);
}
if (!channelId) {
  console.error('Error: SLACK_CHANNEL_ID not set (env var, --channel flag, or ~/.argus/config.json slack.channelId).');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const client = new WebClient(botToken);

console.log(`${dryRun ? '[DRY RUN] ' : ''}Cleaning Argus bot messages from channel ${channelId}\n`);

// Resolve the bot's own user ID so we only delete our messages.
const authInfo = await client.auth.test();
const botUserId = authInfo.user_id;
console.log(`Bot user ID: ${botUserId}\n`);

let totalDeleted = 0;
let totalFailed = 0;
let cursor;

do {
  const history = await client.conversations.history({
    channel: channelId,
    limit: 200,
    ...(cursor ? { cursor } : {}),
  });

  for (const msg of history.messages ?? []) {
    // Only delete messages sent by this bot user
    if (msg.user !== botUserId && msg.bot_id == null) continue;
    // If it's a bot message, confirm it belongs to our app
    if (msg.bot_id != null && msg.username !== undefined) {
      // Keep messages not from our bot (other bots in the channel)
      if (authInfo.bot_id && msg.bot_id !== authInfo.bot_id) continue;
    }

    const ts = msg.ts;
    const preview = (msg.text ?? '').slice(0, 60).replace(/\n/g, ' ');

    // Also delete thread replies before the parent (Slack does not cascade deletes)
    if (msg.reply_count && msg.reply_count > 0) {
      let replyCursor;
      do {
        const thread = await client.conversations.replies({
          channel: channelId,
          ts,
          limit: 200,
          ...(replyCursor ? { cursor: replyCursor } : {}),
        });
        for (const reply of thread.messages ?? []) {
          if (reply.ts === ts) continue; // skip the parent (handled below)
          await deleteMessage(reply.ts, `  reply: ${(reply.text ?? '').slice(0, 50).replace(/\n/g, ' ')}`);
        }
        replyCursor = thread.response_metadata?.next_cursor;
      } while (replyCursor);
    }

    await deleteMessage(ts, preview);
  }

  cursor = history.response_metadata?.next_cursor;
} while (cursor);

console.log(`\nDone. ${dryRun ? 'Would have deleted' : 'Deleted'} ${totalDeleted} message(s). Failed: ${totalFailed}.`);

// ---------------------------------------------------------------------------
// Reset DB thread anchors so the server creates fresh threads on next start
// ---------------------------------------------------------------------------

const dbPath = process.env.ARGUS_DB_PATH ?? join(homedir(), '.argus', 'argus.db');

if (dryRun) {
  console.log(`\n[dry-run] Would reset slack_thread_ts in DB at ${dbPath}`);
} else if (!existsSync(dbPath)) {
  console.log(`\nDB not found at ${dbPath} — skipping thread anchor reset.`);
} else {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    const result = db.prepare('UPDATE sessions SET slack_thread_ts = NULL WHERE slack_thread_ts IS NOT NULL').run();
    db.close();
    console.log(`Reset ${result.changes} thread anchor(s) in DB. Restart the Argus server to apply.`);
  } catch (err) {
    console.error(`Failed to reset thread anchors in DB: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function deleteMessage(ts, preview) {
  console.log(`${dryRun ? '[dry-run] ' : ''}Delete  ts=${ts}  "${preview}"`);
  if (dryRun) {
    totalDeleted++;
    return;
  }
  try {
    await client.chat.delete({ channel: channelId, ts });
    totalDeleted++;
  } catch (err) {
    // message_not_found is harmless (already gone)
    if (err?.data?.error === 'message_not_found') {
      totalDeleted++;
    } else {
      console.error(`  Failed: ${err?.data?.error ?? err.message}`);
      totalFailed++;
    }
    // Slack rate-limits deletes at ~1/sec for free plans
    await new Promise(r => setTimeout(r, 1200));
  }
}
