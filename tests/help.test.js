const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { Collection } = require('discord.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-help-'));
const dbPath = require.resolve('../database');
const isolated = new Module(dbPath, module);
isolated.filename = path.join(temp, 'database.js');
isolated.paths = module.paths;
isolated._compile(fs.readFileSync(dbPath, 'utf8'), isolated.filename);
require.cache[dbPath] = isolated;
const help = require('../utils/help-menu');
const client = { commands: new Collection(), commandFolders: new Map(),
  user: { id: 'bot', username: 'Bot global', displayAvatarURL: () => 'https://example.com/avatar.png' },
  application: { owner: { id: 'owner' } }, ws: { ping: 45 }, uptime: 3661000 };
const root = path.join(__dirname, '..');
for (const folder of fs.readdirSync(path.join(root, 'commands'))) {
  for (const file of fs.readdirSync(path.join(root, 'commands', folder)).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(root, 'commands', folder, file));
    client.commands.set(cmd.name, cmd);
    client.commandFolders.set(cmd.name, folder);
    for (const alias of cmd.aliases || []) {
      assert.ok(!client.commands.has(alias), `Alias dupliqué : ${alias}`);
      client.commands.set(alias, cmd);
    }
  }
}
const guild = { id: 'guild', name: 'Mon serveur', ownerId: 'owner', members: { me: { displayName: 'ObviusProtect' } } };
const context = { client, guild, userId: 'owner', botOwner: true };
const opened = [];
after(() => {
  for (const id of opened) help.expire(id);
  fs.rmSync(temp, { recursive: true, force: true });
});
function assertValid(payload) {
  let length = 0;
  for (const embed of payload.embeds) {
    const data = embed.toJSON();
    length += embed.length;
    assert.ok((data.fields?.length || 0) <= 25);
    assert.ok(!data.description || data.description.length <= 4096);
    for (const field of data.fields || []) assert.ok(field.value.length <= 1024);
  }
  assert.ok(length <= 6000, `Embed trop long : ${length}`);
  assert.ok(payload.components.length <= 5);
  for (const row of payload.components) {
    const data = row.toJSON();
    assert.ok(data.components.length <= 5);
    for (const component of data.components) {
      assert.ok(component.custom_id.length <= 100);
      if (component.options) assert.ok(component.options.length > 0 && component.options.length <= 25);
    }
  }
}
async function open(args = []) {
  const events = [];
  const message = { guild, author: { id: 'owner' }, reply: async payload => {
    events.push(['open', payload]);
    return { edit: async p => events.push(['message-edit', p]) };
  } };
  await help.openHelp(message, args, client);
  const first = events[0][1].components[0].toJSON().components[0].custom_id;
  const id = first.split(':')[1]; opened.push(id);
  function interaction(action, values = []) {
    return { customId: `help:${id}:${action}`, guildId: guild.id, user: { id: 'owner' }, values,
      fields: { getTextInputValue: () => 'bienvenue' },
      deferUpdate: async function() { this.deferred = true; },
      editReply: async p => events.push(['edit', p]), reply: async p => events.push(['reply', p]),
      followUp: async p => events.push(['followup', p]), showModal: async m => events.push(['modal', m.toJSON()]),
    };
  }
  return { events, id, interaction };
}
test('catalogue contains every loaded command once and puts new features in the right categories', () => {
  const commands = help.catalogue(client);
  assert.equal(commands.length, new Set([...client.commands.values()].map(c => c.name)).size);
  assert.ok(commands.length > 90);
  for (const [name, category] of [['welcome', 'community'], ['ticket', 'tickets'], ['setname', 'profile'], ['guide', 'settings']]) {
    assert.equal(commands.find(c => c.name === name).group, category);
  }
});
test('home, guide, every category page and every command card fit Discord limits', () => {
  for (const view of ['home', 'guide', 'search']) assertValid(help.buildView(context, { view, query: 'zzzz', page: 0 }, 'example'));
  for (const cat of help.CATEGORIES) {
    const count = help.catalogue(client).filter(c => c.group === cat.id).length;
    for (let page = 0; page < Math.max(1, Math.ceil(count / 6)); page++) {
      assertValid(help.buildView(context, { view: 'category', category: cat.id, page, mine: false }, 'example'));
    }
  }
  for (const command of help.catalogue(client)) assertValid(help.buildView(context, { view: 'detail', command: command.name }, 'example'));
  assert.match(help.buildView(context, { view: 'home' }, 'example').embeds[0].toJSON().author.name, /ObviusProtect/);
});
test('search matches accents and aliases; the level filter hides restricted global profile commands', () => {
  assert.equal(help.filteredCommands(context, { view: 'search', query: 'bienvenue' })[0].name, 'welcome');
  assert.ok(help.filteredCommands(context, { view: 'search', query: 'moderation' }).some(c => c.name === 'ban'));
  const publicContext = { ...context, userId: 'member', botOwner: false };
  const filtered = help.filteredCommands(publicContext, { view: 'search', query: '', mine: true });
  assert.ok(!filtered.some(c => c.name === 'ban' || c.name === 'setname'));
  assert.ok(filtered.some(c => c.name === 'help'));
});
test('help accepts direct command names, aliases, categories and the setup guide', async () => {
  for (const [query, title] of [['ticket', /&ticket/], ['setpp', /&setavatar/], ['Protection', /Protection/], ['guide', /quelques étapes/]]) {
    const menu = await open([query]);
    assert.match(menu.events[0][1].embeds[0].toJSON().title, title);
  }
});
test('interactive category selection, pagination, command cards, modal search and filtering work', async () => {
  const menu = await open();
  await help.handleHelpInteraction(menu.interaction('category', ['moderation']));
  assert.match(menu.events.at(-1)[1].embeds[0].toJSON().description, /Page \*\*1\//);
  await help.handleHelpInteraction(menu.interaction('next'));
  assert.match(menu.events.at(-1)[1].embeds[0].toJSON().description, /Page \*\*2\//);
  await help.handleHelpInteraction(menu.interaction('command', ['ban']));
  assert.match(menu.events.at(-1)[1].embeds[0].toJSON().title, /&ban/);
  await help.handleHelpInteraction(menu.interaction('search'));
  assert.equal(menu.events.at(-1)[0], 'modal');
  await help.handleHelpInteraction(menu.interaction('query'));
  assert.match(menu.events.at(-1)[1].embeds[0].toJSON().fields[0].name, /&welcome/);
  await help.handleHelpInteraction(menu.interaction('home'));
  await help.handleHelpInteraction(menu.interaction('filter'));
  assert.match(menu.events.at(-1)[1].embeds[0].toJSON().description, /Filtre de niveau actif/);
  assertValid(menu.events.at(-1)[1]);
});
test('other members cannot navigate a menu, and closed/expired sessions answer clearly', async () => {
  const menu = await open();
  const stranger = menu.interaction('category', ['moderation']); stranger.user.id = 'stranger';
  await help.handleHelpInteraction(stranger);
  assert.match(menu.events.at(-1)[1].content, /autre membre/);
  await help.handleHelpInteraction(menu.interaction('close'));
  assert.deepEqual(menu.events.at(-1)[1].components, []);
  await help.handleHelpInteraction(menu.interaction('home'));
  assert.match(menu.events.at(-1)[1].content, /expiré/);
});
test('ping and botinfo report measurements using the same visual style', async () => {
  const events = [];
  const message = { guild, reply: async p => { events.push(p); return { edit: async p => events.push(p) }; } };
  await client.commands.get('ping').execute(message, [], client);
  assert.match(events.at(-1).embeds[0].toJSON().fields[1].value, /45 ms/);
  await client.commands.get('botinfo').execute(message, [], client);
  assert.equal(events.at(-1).embeds[0].toJSON().fields[0].value, String(help.catalogue(client).length));
  assert.equal(help.uptime(3661000), '1 h 1 min');
});
