import { TeamsBotAuthService } from '../src/services/teams-bot-auth-service.js';
import { TeamsGraphClient } from '../src/services/teams-graph-client.js';

const config = {
  botAppId:        '2810fbf9-5d58-4a56-83ec-28761a335cd8',
  tenantId:        'fa8b56d4-a751-45e5-ba0e-10d14685c1ba',
  teamId:          '265d337c-65c2-4404-8060-fe0e12c78543',
  channelId:       '19:2Ent-e4kA6JWQpWAmBczeNdeEhVmuqeCrr5px2C_MrU1@thread.tacv2',
  ownerAadObjectId:'b904c75d-30f9-4f17-9986-4e96c6b680d7',
};

console.log('Getting access token (device code flow)...');
const auth = new TeamsBotAuthService();
const token = await auth.getAccessToken(config);
console.log('Got token! (first 20 chars):', token.substring(0, 20) + '...');

const client = new TeamsGraphClient();
console.log('Posting test message to AarthiN Argus / aarthin-base...');
const { messageId } = await client.createThreadPost(
  config.teamId,
  config.channelId,
  token,
  '<b>Argus Test</b><br>Device code auth working! Testing outbound Teams integration.'
);
console.log('SUCCESS - thread ID:', messageId);
