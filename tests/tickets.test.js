const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { Collection, PermissionsBitField, PermissionFlagsBits: P } = require('discord.js');

// Use the real JSON adapter in an isolated temporary directory, never the live bot database.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crown-tickets-'));
const dbPath = require.resolve('../database');
const isolated = new Module(dbPath, module);
isolated.filename = path.join(temp, 'database.js');
isolated.paths = module.paths;
isolated._compile(fs.readFileSync(dbPath, 'utf8'), isolated.filename);
require.cache[dbPath] = isolated;
const { db } = require('../database');
const panel = require('../utils/ticket-panel');
const system = require('../systems/tickets');
const command = require('../commands/tickets/ticket');
const closeCommand = require('../commands/tickets/close');
const renameCommand = require('../commands/tickets/rename');
after(async () => {
  await new Promise(resolve => setTimeout(resolve, 650));
  fs.rmSync(temp, { recursive: true, force: true });
});

let channelSequence = 200000000000000000n;
function fixture() {
  const id = `g-${Math.random()}`;
  const member = { id: 'user', permissions: new PermissionsBitField(), roles: { cache: new Collection() } };
  const bot = { id: 'bot', permissions: new PermissionsBitField([P.ManageChannels]) };
  const channels = new Collection();
  const events = [];
  const guild = {
    id, ownerId: 'owner', iconURL: () => null,
    members: { me: bot, cache: new Collection([['user', member]]), fetch: async () => member, fetchMe: async () => bot },
    roles: { everyone: { id }, fetch: async id => ({ id }) },
    channels: { fetch: async id => channels.get(id) || null, create: async options => {
      events.push(['create', options]);
      const channel = makeChannel(String(++channelSequence));
      events.push(['created-channel', channel]);
      channels.set(channel.id, channel);
      return channel;
    } },
  };
  function makeChannel(id) {
    const cache = new Collection([
      ['user', { id: 'user', type: 1, allow: new PermissionsBitField([P.ViewChannel, P.SendMessages]), deny: new PermissionsBitField() }],
      ['bot', { id: 'bot', type: 1, allow: new PermissionsBitField([P.SendMessages]), deny: new PermissionsBitField() }],
    ]);
    return {
      id, name: 'ticket-test', type: 0,
      permissionsFor: () => new PermissionsBitField([P.ViewChannel, P.ManageChannels, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory]),
      messages: { fetch: async () => new Collection() },
      permissionOverwrites: { cache, set: async values => events.push(['permissions', values]), edit: async () => events.push(['edit-permission']) },
      send: async payload => { events.push(['send', payload]); return { id: 'welcome', url: 'https://discord.com/channels/test' }; },
      setName: async name => events.push(['rename', name]),
      delete: async () => events.push(['delete']),
    };
  }
  const channel = makeChannel(String(++channelSequence));
  channels.set(channel.id, channel);
  function interaction(customId) {
    return {
      customId, guild, guildId: id, channel, channelId: channel.id,
      user: { id: member.id, username: 'Alice', tag: 'Alice' }, message: { id: 'public-panel' },
      values: ['aide'], fields: { getTextInputValue: key => key === 'subject' ? 'Aide' : 'Ma demande' },
      isModalSubmit: () => customId.startsWith('ticket_create:'),
      isFromMessage: () => true,
      reply: async function(payload) { this.replied = true; events.push(['reply', payload]); },
      deferReply: async function() { this.deferred = true; events.push(['defer']); },
      deferUpdate: async function() { this.deferred = true; events.push(['defer-update']); },
      editReply: async payload => events.push(['result', payload]),
      followUp: async payload => events.push(['followup', payload]),
      showModal: async payload => events.push(['modal', payload.toJSON()]),
      update: async payload => events.push(['update', payload]),
    };
  }
  function insert(status = 'open') {
    db.prepare('INSERT INTO tickets (guild_id, user_id, channel_id, status, topic) VALUES (?, ?, ?, ?, ?)').run(id, 'user', channel.id, status, 'Aide');
  }
  return { guild, member, channels, events, channel, interaction, insert, id };
}

function commandMessage(f) {
  return { guild: f.guild, channel: f.channel, author: { id: f.member.id, tag: 'Alice' },
    reply: async payload => f.events.push(['command-reply', payload]) };
}

test('&close deletes immediately without confirmation and updates the stored ticket', async () => {
  const f = fixture(); f.insert();
  await closeCommand.execute(commandMessage(f), []);
  assert.equal(f.events.filter(e => e[0] === 'delete').length, 1);
  assert.equal(f.events.filter(e => e[0] === 'command-reply').length, 0);
  assert.equal(system.getTicket(f.channel.id).status, 'deleted');
  assert.equal(system.getTicket(f.channel.id).closed_by, 'user');
  const alias = fixture(); alias.insert();
  await command.execute(commandMessage(alias), ['close']);
  assert.equal(system.getTicket(alias.channel.id).status, 'deleted');
});

test('&rename requires a name and joins all following words into the channel name', async () => {
  const f = fixture(); f.insert();
  await renameCommand.execute(commandMessage(f), []);
  assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /Indique le nouveau nom/);
  assert.equal(f.events.some(e => e[0] === 'rename'), false);
  await renameCommand.execute(commandMessage(f), ['Recrutement', 'Paul']);
  assert.equal(f.events.find(e => e[0] === 'rename')[1], 'recrutement-paul');
  assert.match(f.events.at(-1)[1].content, /recrutement-paul/);
  await renameCommand.execute(commandMessage(f), ['a'.repeat(101)]);
  assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /100 caractères/);
  assert.equal(f.events.filter(e => e[0] === 'rename').length, 1);
});

test('close and rename cannot modify ordinary channels or another member’s ticket', async () => {
  for (const cmd of [closeCommand, renameCommand]) {
    const f = fixture();
    await cmd.execute(commandMessage(f), ['nouveau-nom']);
    assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /uniquement dans un ticket/);
    f.insert();
    f.member.id = 'stranger';
    await cmd.execute(commandMessage(f), ['nouveau-nom']);
    assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /Seuls l’auteur/);
    assert.equal(f.events.some(e => ['delete', 'rename'].includes(e[0])), false);
  }
});

test('failed deletion preserves ticket status and releases the action lock for retry', async () => {
  const f = fixture(); f.insert();
  f.channel.delete = async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); };
  await closeCommand.execute(commandMessage(f), []);
  assert.equal(system.getTicket(f.channel.id).status, 'open');
  assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /Discord a refusé/);
  f.channel.delete = async () => f.events.push(['delete']);
  await closeCommand.execute(commandMessage(f), []);
  assert.equal(system.getTicket(f.channel.id).status, 'deleted');
});

test('close saves configured private logs before deletion; failed logs preserve the ticket', async () => {
  for (const failing of [false, true]) {
    const f = fixture(); f.insert();
    const logsId = '123456789012345697';
    panel.saveConfig({ ...panel.getConfig(f.id), logs_channel_id: logsId });
    f.channels.set(logsId, { id: logsId, type: 0, permissionsFor: () => new PermissionsBitField(),
      send: async payload => {
        if (failing) throw new Error('Archive failed');
        f.events.push(['archive', payload]);
      } });
    await closeCommand.execute(commandMessage(f), []);
    if (failing) {
      assert.equal(system.getTicket(f.channel.id).status, 'open');
      assert.equal(f.events.some(e => e[0] === 'delete'), false);
      assert.match(f.events.at(-1)[1].embeds[0].toJSON().description, /ticket est conservé/);
    } else {
      const archiveIndex = f.events.findIndex(e => e[0] === 'archive');
      assert.ok(archiveIndex < f.events.findIndex(e => e[0] === 'delete'));
      assert.equal(f.events[archiveIndex][1].files.length, 1);
      assert.equal(system.getTicket(f.channel.id).status, 'deleted');
    }
  }
});

test('support can close another member’s ticket; concurrent closes delete only once', async () => {
  const f = fixture(); f.insert();
  f.member.id = 'staff';
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await Promise.all([closeCommand.execute(commandMessage(f), []), closeCommand.execute(commandMessage(f), [])]);
  assert.equal(f.events.filter(e => e[0] === 'delete').length, 1);
  assert.equal(system.getTicket(f.channel.id).status, 'deleted');
});

test('Aide and Recrutement open in their own configured categories without a form', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  const categories = { aide: '123456789012345690', recrutement: '123456789012345691' };
  panel.saveConfig({ ...panel.getConfig(f.id), message_id: 'public-panel', category_id: '123456789012345692' });
  await system.handleTicketInteraction(f.interaction('ticket_routes:user'));
  assert.match(f.events.at(-1)[1].content, /Catégories par type/);
  for (const [topicId, categoryId] of Object.entries(categories)) {
    f.channels.set(categoryId, { id: categoryId, type: 4, permissionsFor: () => new PermissionsBitField([P.ViewChannel, P.ManageChannels]) });
    const select = f.interaction(`ticket_route_category:user:${topicId}`);
    select.values = [categoryId];
    await system.handleTicketInteraction(select);
    assert.equal(panel.getConfig(f.id).topic_categories[topicId], categoryId);
    assert.equal(f.events.at(-1)[1].components[1].toJSON().components[0].default_values[0].id, categoryId);
  }
  f.member.permissions = new PermissionsBitField();
  for (const [topicId, categoryId] of Object.entries(categories)) {
    f.member.id = `member-${topicId}`;
    const open = f.interaction('ticket_select');
    open.values = [topicId];
    delete open.fields;
    await system.handleTicketInteraction(open);
    assert.equal(f.events.filter(e => e[0] === 'create').at(-1)[1].parent, categoryId);
  }
  assert.equal(f.events.filter(e => e[0] === 'create').length, 2);
  assert.equal(f.events.filter(e => e[0] === 'modal').length, 0);
  await new Promise(resolve => setTimeout(resolve, 650));
  const disk = JSON.parse(fs.readFileSync(path.join(temp, 'crown.db.json'), 'utf8'));
  assert.deepEqual(disk.tickets_config.find(c => c.guild_id === f.id).topic_categories, categories);
});

test('editing and reordering menu choices retains routes for matching topic names', () => {
  const cfg = panel.getConfig(fixture().id);
  cfg.topic_categories = { aide: '123456789012345690', recrutement: '123456789012345691' };
  const next = panel.applyEditor(cfg, 'topics', { getTextInputValue: () => 'Recrutement | 📋 | Candidature\nAide | ⁉️ | Une question\nAutre | - | Autre demande' });
  assert.equal(next.topics[0].id, 'recrutement');
  assert.equal(next.topics[1].id, 'aide');
  assert.deepEqual(next.topic_categories, cfg.topic_categories);
  assert.ok(!next.topic_categories[next.topics[2].id]);
});

test('type category controls reject unauthorized edits and invalid categories; clearing restores fallback', async () => {
  const f = fixture();
  const select = f.interaction('ticket_route_category:user:aide');
  select.values = [f.channel.id];
  await system.handleTicketInteraction(select);
  assert.match(f.events.at(-1)[1].content, /réservé à son administrateur/);
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await system.handleTicketInteraction(select);
  assert.match(f.events.at(-1)[1].content, /Choisis une catégorie/);
  assert.ok(!panel.getConfig(f.id).topic_categories);
  const gone = f.interaction('ticket_route_category:user:deleted-topic');
  gone.values = [];
  await system.handleTicketInteraction(gone);
  assert.match(f.events.at(-1)[1].content, /supprimé/);
  panel.saveConfig({ ...panel.getConfig(f.id), topic_categories: { aide: '123456789012345690' }, category_id: '123456789012345691' });
  const clear = f.interaction('ticket_route_category:user:aide');
  clear.values = [];
  await system.handleTicketInteraction(clear);
  assert.ok(!panel.getConfig(f.id).topic_categories.aide);
  assert.equal(panel.getConfig(f.id).category_id, '123456789012345691');
});

test('a deleted type category blocks creation instead of falling back silently', async () => {
  const f = fixture();
  panel.saveConfig({ ...panel.getConfig(f.id), message_id: 'public-panel', topic_categories: { aide: '123456789012345699' } });
  await system.handleTicketInteraction(f.interaction('ticket_select'));
  assert.match(f.events.at(-1)[1].content, /catégorie de tickets n’existe plus/);
  assert.equal(f.events.filter(e => e[0] === 'create').length, 0);
});

test('panel serializes and validates customization including emoji and invalid URLs', () => {
  const f = fixture();
  const cfg = panel.getConfig(f.id);
  const payload = panel.buildPanel(cfg, f.guild);
  assert.equal(payload.components[0].toJSON().components[0].options.length, 2);
  for (const kind of ['text', 'topics', 'visual']) assert.ok(panel.editorModal(kind, cfg, 'user').toJSON());
  const topics = panel.parseTopics('Aide | ⁉️ | Une question\nAchat | 🛒 | Une commande\nAutre | - |');
  assert.equal(topics[2].emoji, '');
  assert.equal(new Set(topics.map(t => t.id)).size, 3);
  assert.throws(() => panel.parseTopics('Aide | invalide | Test'));
  assert.throws(() => panel.parseTopics(''));
  assert.throws(() => panel.parseTopics(Array(26).fill('Aide').join('\n')));
  assert.throws(() => panel.applyEditor(cfg, 'visual', { getTextInputValue: k => k === 'image' ? 'http://example.com/a.png' : 'Choisis' }));
});

test('draft saving preserves published choices and persists via the JSON adapter', async () => {
  const f = fixture();
  const cfg = panel.getConfig(f.id);
  cfg.channel_id = f.channel.id;
  await panel.publishPanel(cfg, f.guild);
  const saved = panel.getConfig(f.id);
  saved.topics = panel.parseTopics('Vente | 🛒 | Acheter');
  panel.saveConfig(saved);
  assert.equal(panel.getConfig(f.id).published_topics[0].id, 'aide');
  await new Promise(resolve => setTimeout(resolve, 650));
  const disk = JSON.parse(fs.readFileSync(path.join(temp, 'crown.db.json'), 'utf8'));
  assert.equal(disk.tickets_config.find(c => c.guild_id === f.id).topics[0].label, 'Vente');
});

test('menu opens a ticket directly without form fields; obsolete panels are rejected', async () => {
  const f = fixture();
  panel.saveConfig({ ...panel.getConfig(f.id), message_id: 'public-panel' });
  const select = f.interaction('ticket_select');
  delete select.fields;
  await system.handleTicketInteraction(select);
  assert.equal(f.events.filter(e => e[0] === 'create').length, 1);
  assert.equal(f.events.filter(e => e[0] === 'modal').length, 0);
  const welcome = f.events.find(e => e[0] === 'send')[1].embeds[0].toJSON();
  assert.match(welcome.description, /Explique directement ta demande/);
  assert.ok(!welcome.fields);
  const stale = f.interaction('ticket_select');
  stale.message.id = 'old';
  await system.handleTicketInteraction(stale);
  assert.match(f.events.at(-1)[1].content, /remplacé/);
});

test('ticket creation uses private overwrites and prevents duplicate or concurrent openings', async () => {
  const f = fixture();
  panel.saveConfig({ ...panel.getConfig(f.id), staff_role_id: 'support' });
  await Promise.all([system.handleTicketInteraction(f.interaction('ticket_create:aide')), system.handleTicketInteraction(f.interaction('ticket_create:aide'))]);
  assert.equal(f.events.filter(e => e[0] === 'create').length, 1);
  const options = f.events.find(e => e[0] === 'create')[1];
  assert.ok(options.permissionOverwrites.find(p => p.id === f.id).deny.includes(P.ViewChannel));
  assert.ok(options.permissionOverwrites.find(p => p.id === 'support').allow.includes(P.ViewChannel));
  assert.equal(system.getTicket(f.events.find(e => e[0] === 'created-channel')[1].id).user_id, 'user');
  await system.handleTicketInteraction(f.interaction('ticket_create:aide'));
  assert.match(f.events.at(-1)[1].content, /déjà un ticket ouvert/);
});

test('an unrelated member cannot close or download a private ticket', async () => {
  const f = fixture(); f.insert();
  f.member.id = 'stranger';
  await system.handleTicketInteraction(f.interaction('ticket_close'));
  assert.match(f.events.at(-1)[1].content, /Seuls l’auteur/);
  await system.handleTicketInteraction(f.interaction('ticket_transcript'));
  assert.match(f.events.at(-1)[1].content, /Seuls l’auteur/);
  assert.equal(f.events.filter(e => e[0] === 'permissions').length, 0);
});

test('owner closes with confirmation; only support can reopen or delete', async () => {
  const f = fixture(); f.insert();
  await system.handleTicketInteraction(f.interaction('ticket_close'));
  assert.equal(system.getTicket(f.channel.id).status, 'open');
  await system.handleTicketInteraction(f.interaction('ticket_confirm_close:user'));
  assert.equal(system.getTicket(f.channel.id).status, 'closed');
  const permissions = f.events.find(e => e[0] === 'permissions')[1];
  assert.ok(permissions.find(p => p.id === 'user').deny.has(P.SendMessages));
  assert.ok(permissions.find(p => p.id === 'user').allow.has(P.ViewChannel));
  await system.handleTicketInteraction(f.interaction('ticket_reopen'));
  assert.equal(system.getTicket(f.channel.id).status, 'closed');
  await system.handleTicketInteraction(f.interaction('ticket_confirm_delete:user'));
  assert.equal(f.events.some(e => e[0] === 'delete'), false);
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await system.handleTicketInteraction(f.interaction('ticket_reopen'));
  assert.equal(system.getTicket(f.channel.id).status, 'open');
});

test('transcripts paginate and preserve chronological order, text, embeds and attachment links', async () => {
  const f = fixture();
  const make = i => ({ id: `${i}`, createdTimestamp: i * 1000, author: { tag: 'Alice', id: 'u' }, content: `Message ${i}`,
    embeds: i === 1 ? [{ title: 'Titre', description: 'Description' }] : [],
    attachments: new Collection(i === 1 ? [['a', { url: 'https://example.com/file' }]] : []) });
  const calls = [];
  f.channel.messages.fetch = async opts => { calls.push(opts); return opts.before ? new Collection([['1', make(1)]])
    : new Collection(Array.from({ length: 100 }, (_, i) => [`${i + 2}`, make(i + 2)])); };
  const attachment = await system.createTranscript(f.channel, { user_id: 'u' });
  const text = attachment.attachment.toString();
  assert.equal(calls[1].before, '2');
  assert.ok(text.indexOf('Message 1\n') < text.indexOf('Message 101\n'));
  assert.match(text, /Titre\nDescription/);
  assert.match(text, /https:\/\/example.com\/file/);
});

test('setup and participant commands deny unauthorized changes', async () => {
  const f = fixture(); f.insert();
  const replies = [];
  const msg = { guild: f.guild, member: f.member, author: { id: 'user' }, channel: f.channel, reply: async p => replies.push(p) };
  await command.execute(msg, ['setup']);
  assert.match(replies.at(-1).embeds[0].toJSON().description, /administrateurs/);
  await command.execute(msg, ['add', '<@123456789012345678>']);
  assert.match(replies.at(-1).embeds[0].toJSON().description, /Seul le support/);
  assert.equal(f.events.some(e => e[0] === 'edit-permission'), false);
});

test('failed welcome messages roll back newly created channels without recording a ticket', async () => {
  const f = fixture();
  f.guild.channels.create = async () => ({
    id: 'failed-channel',
    send: async () => { throw new Error('Simulated send failure'); },
    delete: async () => f.events.push(['rollback']),
  });
  await system.handleTicketInteraction(f.interaction('ticket_create:aide'));
  assert.ok(f.events.some(e => e[0] === 'rollback'));
  assert.equal(system.getTicket('failed-channel'), undefined);
  assert.match(f.events.at(-1)[1].content, /Simulated send failure/);
});

test('reopening cannot give one author a second active ticket', async () => {
  const f = fixture(); f.insert('closed');
  db.prepare('INSERT INTO tickets (guild_id, user_id, channel_id, status) VALUES (?, ?, ?, ?)').run(f.id, 'user', 'another-ticket', 'open');
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await system.handleTicketInteraction(f.interaction('ticket_reopen'));
  assert.equal(system.getTicket(f.channel.id).status, 'closed');
  assert.match(f.events.at(-1)[1].content, /déjà un ticket ouvert/);
});

test('admin editor supports modal saving and rejects a different editor owner', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await system.handleTicketInteraction(f.interaction('ticket_edit_text:user'));
  assert.equal(f.events.at(-1)[0], 'modal');
  const edit = f.interaction('ticket_save_text:user');
  edit.fields.getTextInputValue = key => ({ title: 'Mon support', description: 'Mon texte', footer: 'Mon serveur', color: '#FF00AA' })[key];
  await system.handleTicketInteraction(edit);
  assert.equal(panel.getConfig(f.id).title, 'Mon support');
  assert.equal(panel.getConfig(f.id).color, 0xFF00AA);
  assert.equal(f.events.at(-1)[0], 'update');
  await system.handleTicketInteraction(f.interaction('ticket_edit_text:someone-else'));
  assert.match(f.events.at(-1)[1].content, /réservé à son administrateur/);
});

test('private transcripts cannot be configured to a public log channel', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  const logId = '123456789012345678';
  f.channels.set(logId, { type: 0, permissionsFor: () => new PermissionsBitField([P.ViewChannel]) });
  const replies = [];
  await command.execute({ guild: f.guild, author: { id: 'user' }, channel: f.channel, reply: async p => replies.push(p) }, ['logs', `<#${logId}>`]);
  assert.match(replies.at(-1).embeds[0].toJSON().description, /salon de logs privé/);
  assert.equal(panel.getConfig(f.id).logs_channel_id, undefined);
});

test('setup opens configuration selectors without posting the public panel', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  const replies = [];
  await command.execute({ guild: f.guild, author: { id: 'user' }, channel: f.channel, reply: async p => replies.push(p) }, ['setup']);
  assert.equal(replies.length, 1);
  const rows = replies[0].components.map(row => row.toJSON());
  assert.deepEqual(rows[0].components[0].channel_types, [4]);
  assert.equal(rows[0].components[0].custom_id, 'ticket_settings_category:user');
  assert.deepEqual(rows[1].components[0].channel_types, [0]);
  assert.equal(rows[2].components[0].type, 6);
  assert.equal(panel.getConfig(f.id).channel_id, f.channel.id);
  assert.ok(!panel.getConfig(f.id).message_id);
  assert.equal(f.events.filter(e => e[0] === 'send').length, 0);
});

test('category selection persists and ticket creation uses the selected parent', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  const categoryId = '123456789012345679';
  f.channels.set(categoryId, { id: categoryId, type: 4, permissionsFor: () => new PermissionsBitField([P.ViewChannel, P.ManageChannels]) });
  const select = f.interaction('ticket_settings_category:user');
  select.values = [categoryId];
  await system.handleTicketInteraction(select);
  assert.equal(panel.getConfig(f.id).category_id, categoryId);
  assert.equal(f.events.at(-1)[0], 'result');
  const menu = f.events.at(-1)[1].components[0].toJSON().components[0];
  assert.equal(menu.default_values[0].id, categoryId);
  await system.handleTicketInteraction(f.interaction('ticket_create:aide'));
  assert.equal(f.events.find(e => e[0] === 'create')[1].parent, categoryId);
  const clear = f.interaction('ticket_settings_category:user');
  clear.values = [];
  await system.handleTicketInteraction(clear);
  assert.equal(panel.getConfig(f.id).category_id, null);
});

test('configuration selectors reject wrong types, missing permissions and unauthorized editors', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  const wrongType = f.interaction('ticket_settings_category:user');
  wrongType.values = [f.channel.id];
  await system.handleTicketInteraction(wrongType);
  assert.equal(f.events.at(-1)[0], 'followup');
  assert.match(f.events.at(-1)[1].content, /type demandé/);
  assert.equal(panel.getConfig(f.id).category_id, undefined);
  const categoryId = '123456789012345680';
  f.channels.set(categoryId, { id: categoryId, type: 4, permissionsFor: () => new PermissionsBitField() });
  const denied = f.interaction('ticket_settings_category:user');
  denied.values = [categoryId];
  await system.handleTicketInteraction(denied);
  assert.match(f.events.at(-1)[1].content, /gérer les salons/);
  f.member.permissions = new PermissionsBitField();
  await system.handleTicketInteraction(f.interaction('ticket_settings_category:user'));
  assert.match(f.events.at(-1)[1].content, /réservé à son administrateur/);
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  await system.handleTicketInteraction(f.interaction('ticket_settings_category:other'));
  assert.match(f.events.at(-1)[1].content, /réservé à son administrateur/);
});

test('role and panel channel selectors persist valid choices and reject everyone', async () => {
  const f = fixture();
  f.member.permissions = new PermissionsBitField([P.Administrator]);
  const role = f.interaction('ticket_settings_role:user');
  role.values = ['123456789012345681'];
  await system.handleTicketInteraction(role);
  assert.equal(panel.getConfig(f.id).staff_role_id, role.values[0]);
  const destination = f.interaction('ticket_settings_channel:user');
  destination.values = [f.channel.id];
  await system.handleTicketInteraction(destination);
  assert.equal(panel.getConfig(f.id).channel_id, f.channel.id);
  const editor = f.events.at(-1)[1];
  editor.components.forEach(c => c.toJSON());
  role.values = [f.guild.id];
  await system.handleTicketInteraction(role);
  assert.match(f.events.at(-1)[1].content, /@everyone/);
  assert.equal(panel.getConfig(f.id).staff_role_id, '123456789012345681');
});
