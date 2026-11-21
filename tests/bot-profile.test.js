const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { Collection, ActivityType } = require('discord.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crown-profile-'));
const dbPath = require.resolve('../database');
const isolated = new Module(dbPath, module);
isolated.filename = path.join(temp, 'database.js');
isolated.paths = module.paths;
isolated._compile(fs.readFileSync(dbPath, 'utf8'), isolated.filename);
require.cache[dbPath] = isolated;
const profile = require('../utils/bot-profile');
const commands = {
  status: require('../commands/config/setstatus'), name: require('../commands/config/setusername'),
  avatar: require('../commands/config/setavatar'),
};
after(async () => {
  await new Promise(resolve => setTimeout(resolve, 650));
  fs.rmSync(temp, { recursive: true, force: true });
});
let sequence = 0;
const nicknameCommand = require('../commands/config/setname');

test('setname changes only the server nickname even while the global username is rate limited', async () => {
  const f = fixture();
  f.client.user.setUsername = async () => { throw new Error('Global username rate limited'); };
  f.message.guild = { id: 'server', members: { fetchMe: async () => ({ nickname: 'Old name',
    setNickname: async (name, reason) => f.events.push(['nickname', name, reason]) }) } };
  await nicknameCommand.execute(f.message, ['!ObviusProtect'], f.client);
  assert.equal(f.events.find(e => e[0] === 'nickname')[1], '!ObviusProtect');
  assert.equal(f.events.some(e => e[0] === 'name'), false);
  assert.match(f.events.at(-1)[1].description, /Nom affiché sur ce serveur/);
  assert.match(f.events.at(-1)[1].description, /nom global du compte reste inchangé/);
});

test('setname validates input and explains missing nickname permissions', async () => {
  const f = fixture();
  f.message.guild = { id: 'server', members: { fetchMe: async () => ({ nickname: 'Old',
    setNickname: async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); } }) } };
  await nicknameCommand.execute(f.message, [], f.client);
  assert.match(f.events.at(-1)[1].description, /1 et 32 caractères/);
  await nicknameCommand.execute(f.message, ['x'.repeat(33)], f.client);
  assert.match(f.events.at(-1)[1].description, /1 et 32 caractères/);
  await nicknameCommand.execute(f.message, ['ObviusProtect'], f.client);
  assert.match(f.events.at(-1)[1].description, /Changer le pseudo/);
});

test('setname denies other users and skips redundant nickname updates', async () => {
  const f = fixture();
  f.message.guild = { id: 'server', members: { fetchMe: async () => ({ nickname: 'ObviusProtect',
    setNickname: async () => { throw new Error('Must not be called'); } }) } };
  f.message.author.id = 'stranger';
  await nicknameCommand.execute(f.message, ['Other'], f.client);
  assert.match(f.events.at(-1)[1].description, /propriétaire de l’application/);
  f.message.author.id = 'owner';
  await nicknameCommand.execute(f.message, ['ObviusProtect'], f.client);
  assert.match(f.events.at(-1)[1].description, /déjà ce nom sur ce serveur/);
});

function fixture() {
  const events = [];
  const client = { application: { owner: { id: 'owner' } }, user: {
    id: `bot-${++sequence}`,
    setActivity: (...args) => events.push(['activity', args]),
    setUsername: async name => events.push(['name', name]),
    setAvatar: async url => events.push(['avatar', url]),
  } };
  const message = { author: { id: 'owner' }, attachments: new Collection(),
    reply: async payload => events.push(['reply', payload.embeds[0].toJSON()]) };
  return { client, message, events };
}

test('global profile changes require application ownership', async () => {
  const f = fixture();
  f.message.author.id = 'server-admin';
  for (const [action, command] of Object.entries(commands)) await command.execute(f.message, ['Example'], f.client);
  assert.equal(f.events.filter(e => e[0] !== 'reply').length, 0);
  assert.match(f.events.at(-1)[1].description, /propriétaire de l’application/);
  const team = fixture();
  team.client.application.owner = { id: 'team-id', ownerId: 'owner' };
  assert.equal(await profile.isBotOwner('owner', team.client), true);
  assert.equal(await profile.isBotOwner('team-id', team.client), false);
});

test('activity persists to disk and is restored after restart, including off', async () => {
  const f = fixture();
  await commands.status.execute(f.message, ['&help', '|', 'Mon', 'serveur'], f.client);
  assert.equal(profile.activityText(f.client), '&help | Mon serveur');
  profile.restoreActivity(f.client);
  assert.deepEqual(f.events.filter(e => e[0] === 'activity').at(-1)[1], ['&help | Mon serveur', { type: ActivityType.Watching }]);
  await new Promise(resolve => setTimeout(resolve, 650));
  const disk = JSON.parse(fs.readFileSync(path.join(temp, 'crown.db.json'), 'utf8'));
  assert.equal(disk.bot_settings.find(s => s.bot_id === f.client.user.id).activity_text, '&help | Mon serveur');
  await commands.status.execute(f.message, ['off'], f.client);
  profile.restoreActivity(f.client);
  assert.deepEqual(f.events.filter(e => e[0] === 'activity').at(-1)[1], []);
  const empty = fixture();
  profile.restoreActivity(empty.client);
  assert.equal(empty.events[0][1][0], '&help | Crown Bot');
});

test('empty and overlong status or names are rejected before API calls', async () => {
  const f = fixture();
  await commands.status.execute(f.message, [], f.client);
  await commands.status.execute(f.message, ['x'.repeat(129)], f.client);
  await commands.name.execute(f.message, [], f.client);
  await commands.name.execute(f.message, ['x'.repeat(33)], f.client);
  assert.equal(f.events.filter(e => e[0] !== 'reply').length, 0);
  await commands.name.execute(f.message, ['Mon', 'Bot'], f.client);
  assert.equal(f.events.find(e => e[0] === 'name')[1], 'Mon Bot');
});

test('avatar accepts HTTPS links or attached images and rejects paths and nonimages', async () => {
  const f = fixture();
  for (const source of ['C:\\secret.png', 'file:///secret.png', 'http://example.com/image.png', 'https://user:password@example.com/a.png']) {
    await commands.avatar.execute(f.message, [source], f.client);
  }
  assert.equal(f.events.filter(e => e[0] === 'avatar').length, 0);
  await commands.avatar.execute(f.message, ['https://example.com/image.png'], f.client);
  f.message.attachments.set('image', { url: 'https://cdn.discordapp.com/image.png', contentType: 'image/png' });
  await commands.avatar.execute(f.message, [], f.client);
  assert.equal(f.events.filter(e => e[0] === 'avatar').length, 2);
  f.message.attachments.set('image', { url: 'https://example.com/file.txt', contentType: 'text/plain' });
  await commands.avatar.execute(f.message, [], f.client);
  assert.match(f.events.at(-1)[1].description, /doit être une image/);
});

test('API rejection reports an error and allows retry', async () => {
  const f = fixture();
  f.client.user.setUsername = async () => { throw new Error('Discord rejected username'); };
  await commands.name.execute(f.message, ['Mon Bot'], f.client);
  assert.match(f.events.at(-1)[1].description, /Discord a refusé/);
  f.client.user.setUsername = async name => f.events.push(['name', name]);
  await commands.name.execute(f.message, ['Mon Bot'], f.client);
  assert.equal(f.events.find(e => e[0] === 'name')[1], 'Mon Bot');
});

test('concurrent profile requests cannot release another in-flight operation’s lock', async () => {
  const f = fixture();
  let finish;
  f.client.user.setUsername = () => new Promise(resolve => { finish = resolve; f.events.push(['name-request']); });
  const first = commands.name.execute(f.message, ['First Bot'], f.client);
  await new Promise(resolve => setImmediate(resolve));
  await commands.name.execute(f.message, ['Second Bot'], f.client);
  await commands.name.execute(f.message, ['Third Bot'], f.client);
  assert.equal(f.events.filter(e => e[0] === 'name-request').length, 1);
  finish();
  await first;
});

test('username rate limits returned inside a 50035 error are explained accurately', async () => {
  const f = fixture();
  f.client.user.setUsername = async () => { throw Object.assign(new Error('Invalid Form Body'), {
    code: 50035, rawError: { errors: { username: { _errors: [{ code: 'USERNAME_RATE_LIMIT',
      message: 'You are changing your username or Discord Tag too fast.' }] } } },
  }); };
  await commands.name.execute(f.message, ['ObviusProtect'], f.client);
  assert.match(f.events.at(-1)[1].description, /changements de nom/);
  assert.match(f.events.at(-1)[1].description, /redémarrer le bot ne supprime pas ce délai/);
});

test('invalid usernames show the field-specific Discord reason and API error code', async () => {
  const f = fixture();
  f.client.user.setUsername = async () => { throw Object.assign(new Error('Invalid Form Body'), {
    code: 50035, rawError: { errors: { username: { _errors: [{ code: 'USERNAME_INVALID', message: 'This username is not allowed.' }] } } },
  }); };
  await commands.name.execute(f.message, ['ObviusProtect'], f.client);
  const text = f.events.at(-1)[1].description;
  assert.match(text, /50035/);
  assert.match(text, /This username is not allowed/);
  assert.doesNotMatch(text, /trop rapprochés/);
});

test('HTTP rate limits use the server retry delay and identical names skip the API', async () => {
  const f = fixture();
  f.client.user.setUsername = async () => { throw Object.assign(new Error('Too many requests'), { status: 429, rawError: { retry_after: 125 } }); };
  await commands.name.execute(f.message, ['ObviusProtect'], f.client);
  assert.match(f.events.at(-1)[1].description, /3 minute/);
  f.client.user.username = 'ObviusProtect';
  await commands.name.execute(f.message, ['ObviusProtect'], f.client);
  assert.match(f.events.at(-1)[1].description, /déjà ce nom/);
});
