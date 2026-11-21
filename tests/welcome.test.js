const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { Collection, PermissionsBitField, PermissionFlagsBits: P } = require('discord.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crown-welcome-'));
const dbPath = require.resolve('../database');
const isolated = new Module(dbPath, module);
isolated.filename = path.join(temp, 'database.js');
isolated.paths = module.paths;
isolated._compile(fs.readFileSync(dbPath, 'utf8'), isolated.filename);
require.cache[dbPath] = isolated;
const welcome = require('../systems/welcome');
const command = require('../commands/config/welcome');
after(async () => {
  await new Promise(resolve => setTimeout(resolve, 650));
  fs.rmSync(temp, { recursive: true, force: true });
});
let sequence = 0;
function fixture() {
  const events = [];
  const guild = { id: `guild-${++sequence}`, name: 'Mon serveur', ownerId: 'owner', memberCount: 42 };
  const bot = { permissions: new PermissionsBitField([P.ManageRoles]) };
  const member = { id: 'member', guild, user: { username: 'Alice', bot: false, displayAvatarURL: () => 'https://example.com/avatar.png' },
    permissions: new PermissionsBitField(), roles: { add: async id => events.push(['add-role', id]) } };
  const channel = { id: '123456789012345678', type: 0, permissionsFor: () => new PermissionsBitField([P.ViewChannel, P.SendMessages, P.EmbedLinks]),
    send: async p => events.push(['send', p]) };
  const role = { id: '123456789012345679', managed: false, editable: true };
  guild.members = { fetchMe: async () => bot, fetch: async () => member };
  guild.roles = { fetch: async id => id === role.id ? role : null };
  guild.channels = { fetch: async id => id === channel.id ? channel : null };
  function interaction(action, values = []) {
    return { customId: `welcome_${action}:${member.id}`, guild, guildId: guild.id, user: { id: member.id }, values,
      fields: { getTextInputValue: () => 'Bienvenue {user} sur {server} ! {username} : membre {membercount}' },
      reply: async p => events.push(['reply', p]), update: async p => events.push(['update', p]),
      deferUpdate: async function() { this.deferred = true; }, deferReply: async function() { this.deferred = true; },
      editReply: async p => events.push(['edit', p]), followUp: async p => events.push(['followup', p]),
      showModal: async p => events.push(['modal', p.toJSON()]),
    };
  }
  function save() { welcome.saveSettings({ ...welcome.getSettings(guild.id), channel_id: channel.id, role_id: role.id }); }
  return { events, guild, bot, member, channel, role, interaction, save };
}

test('joining members receive a role and a welcome with only their own ping allowed', async () => {
  const f = fixture(); f.save();
  await welcome.handleWelcome(f.member);
  assert.equal(f.events.find(e => e[0] === 'add-role')[1], f.role.id);
  const payload = f.events.find(e => e[0] === 'send')[1];
  assert.match(payload.content, /<@member>/);
  assert.deepEqual(payload.allowedMentions.users, ['member']);
  assert.deepEqual(payload.allowedMentions.parse, []);
  assert.match(payload.embeds[0].toJSON().description, /Mon serveur/);
  assert.match(payload.embeds[0].toJSON().description, /42 membres/);
});

test('disabled configurations and bot arrivals do nothing; role and message can work independently', async () => {
  const f = fixture(); f.save();
  welcome.saveSettings({ ...welcome.getSettings(f.guild.id), enabled: false });
  await welcome.handleWelcome(f.member);
  assert.equal(f.events.length, 0);
  f.save();
  welcome.saveSettings({ ...welcome.getSettings(f.guild.id), enabled: true });
  f.member.user.bot = true;
  await welcome.handleWelcome(f.member);
  assert.equal(f.events.length, 0);
  f.member.user.bot = false;
  welcome.saveSettings({ ...welcome.getSettings(f.guild.id), channel_id: null });
  await welcome.handleWelcome(f.member);
  assert.equal(f.events.at(-1)[0], 'add-role');
  welcome.saveSettings({ ...welcome.getSettings(f.guild.id), channel_id: f.channel.id, role_id: null });
  await welcome.handleWelcome(f.member);
  assert.equal(f.events.at(-1)[0], 'send');
});

test('a role hierarchy failure does not prevent the welcome message', async () => {
  const f = fixture(); f.save(); f.role.editable = false;
  await welcome.handleWelcome(f.member);
  assert.equal(f.events.some(e => e[0] === 'add-role'), false);
  assert.equal(f.events.some(e => e[0] === 'send'), true);
});

test('configuration menu is protected and saves the selected channel and role', async () => {
  const f = fixture();
  await welcome.handleWelcomeInteraction(f.interaction('channel', [f.channel.id]));
  assert.match(f.events.at(-1)[1].content, /réservé à son administrateur/);
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await welcome.handleWelcomeInteraction(f.interaction('channel', [f.channel.id]));
  await welcome.handleWelcomeInteraction(f.interaction('role', [f.role.id]));
  assert.equal(welcome.getSettings(f.guild.id).channel_id, f.channel.id);
  assert.equal(welcome.getSettings(f.guild.id).role_id, f.role.id);
  f.events.at(-1)[1].components.forEach(row => row.toJSON());
  await new Promise(resolve => setTimeout(resolve, 650));
  const disk = JSON.parse(fs.readFileSync(path.join(temp, 'crown.db.json'), 'utf8'));
  assert.equal(disk.welcome.find(row => row.guild_id === f.guild.id).role_id, f.role.id);
});

test('invalid managed or unassignable roles cannot be saved', async () => {
  const f = fixture(); f.member.permissions = new PermissionsBitField([P.Administrator]);
  f.role.managed = true;
  await welcome.handleWelcomeInteraction(f.interaction('role', [f.role.id]));
  assert.match(f.events.at(-1)[1].content, /rôle normal/);
  f.role.managed = false; f.role.editable = false;
  await welcome.handleWelcomeInteraction(f.interaction('role', [f.role.id]));
  assert.match(f.events.at(-1)[1].content, /au-dessus/);
  assert.ok(!welcome.getSettings(f.guild.id).role_id);
});

test('message editing uses variables, test sends no role, and toggle disables the system', async () => {
  const f = fixture(); f.save(); f.member.permissions = new PermissionsBitField([P.Administrator]);
  await welcome.handleWelcomeInteraction(f.interaction('text'));
  assert.equal(f.events.at(-1)[0], 'modal');
  await welcome.handleWelcomeInteraction(f.interaction('save'));
  await welcome.handleWelcomeInteraction(f.interaction('test'));
  assert.equal(f.events.some(e => e[0] === 'add-role'), false);
  assert.match(f.events.find(e => e[0] === 'send')[1].embeds[0].toJSON().description, /Alice : membre 42/);
  await welcome.handleWelcomeInteraction(f.interaction('toggle'));
  assert.equal(welcome.getSettings(f.guild.id).enabled, false);
});

test('welcome command opens selectors only for administrators', async () => {
  const f = fixture();
  const message = { guild: f.guild, author: { id: f.member.id }, reply: async p => f.events.push(['command', p]) };
  await command.execute(message, ['setup']);
  assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /réservée aux administrateurs/);
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await command.execute(message, ['setup']);
  const rows = f.events.at(-1)[1].components.map(r => r.toJSON());
  assert.equal(rows[0].components[0].type, 8);
  assert.equal(rows[1].components[0].type, 6);
});
