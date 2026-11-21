const { Client, GatewayIntentBits, Collection, Events, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});

client.commands = new Collection();
client.commandFolders = new Map();
client.snipes = new Collection();
client.followIntervals = new Collection();
client.musliereCache = new Set();

const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, 'commands', folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(folderPath, file));
    if (cmd.name) {
      client.commands.set(cmd.name, cmd);
      client.commandFolders.set(cmd.name, folder);
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          client.commands.set(alias, cmd);
        }
      }
    }
  }
}

const systems = fs.readdirSync(path.join(__dirname, 'systems')).filter(f => f.endsWith('.js'));
for (const file of systems) {
  const system = require(path.join(__dirname, 'systems', file));
  if (system.init) system.init(client);
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot connecté en tant que ${c.user.tag}`);
  console.log(`${require('./utils/help-menu').catalogue(c).length} commandes chargées`);
  require('./utils/bot-profile').restoreActivity(c);

  const { cacheInvites } = require('./systems/invites');
  for (const [, guild] of c.guilds.cache) {
    cacheInvites(guild).catch(() => {});
  }

  checkTempbans();
  updateCounters();

  setInterval(checkTempbans, 60_000);
  setInterval(updateCounters, 300_000);
});

function checkTempbans() {
  const { db } = require('./database');
  const expired = db.prepare('SELECT * FROM tempbans WHERE expires_at < ?').all(Date.now());
  for (const ban of expired) {
    const guild = client.guilds.cache.get(ban.guild_id);
    if (guild) guild.members.unban(ban.user_id, 'Tempban expire').catch(() => {});
    db.prepare('DELETE FROM tempbans WHERE user_id = ? AND guild_id = ?').run(ban.user_id, ban.guild_id);
  }
}

function updateCounters() {
  const { db } = require('./database');
  const counters = db.prepare('SELECT * FROM counters').all();
  for (const c of counters) {
    const guild = client.guilds.cache.get(c.guild_id);
    if (!guild) continue;
    const channel = guild.channels.cache.get(c.channel_id);
    if (!channel) continue;

    const counts = {
      members: guild.memberCount,
      humans: guild.members.cache.filter(m => !m.user.bot).size,
      bots: guild.members.cache.filter(m => m.user.bot).size,
      roles: guild.roles.cache.size,
      channels: guild.channels.cache.size,
      online: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
    };

    const name = c.template.replace('{count}', counts[c.type] || 0);
    channel.setName(name).catch(() => {});
  }
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const { db } = require('./database');

  const { handleAntiraid } = require('./systems/antiraid');
  if (await handleAntiraid(message)) return;

  const muz = db.prepare('SELECT * FROM museliere WHERE user_id = ? AND guild_id = ?').get(message.author.id, message.guild.id);
  if (muz) {
    if (muz.expires_at && Date.now() > muz.expires_at) {
      db.prepare('DELETE FROM museliere WHERE user_id = ? AND guild_id = ?').run(message.author.id, message.guild.id);
    } else if (!message.content.startsWith(config.prefix)) {
      const sheep = '🐑 ' + 'bê'.repeat(Math.floor(Math.random() * 4) + 1) + 'ê'.repeat(Math.floor(Math.random() * 3));
      await message.delete().catch(() => {});
      await message.channel.send(`${message.author} : ${sheep}`).catch(() => {});
      return;
    }
  }

  const handleXp = require('./systems/leveling');
  if (handleXp.handleXp) handleXp.handleXp(message);

  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  let command = client.commands.get(commandName);

  if (!command) {
    const custom = db.prepare('SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?').get(message.guild.id, commandName);
    if (custom) return message.reply(custom.response);
    return;
  }

  const { hasPermission } = require('./utils/permissions');
  const { noPerms } = require('./utils/embeds');

  if (command.permission && !hasPermission(message.author.id, message.guild, command.permission)) {
    return message.reply({ embeds: [noPerms()] });
  }

  try {
    await command.execute(message, args, client);
  } catch (err) {
    console.error(`Erreur commande ${commandName}:`, err);
    message.reply({ embeds: [require('./utils/embeds').error('Une erreur est survenue.')] }).catch(() => {});
  }
});

client.on(Events.MessageDelete, (message) => {
  if (!message.guild || message.author?.bot) return;
  client.snipes.set(message.channel.id, {
    content: message.content,
    author: message.author,
    attachments: [...message.attachments.values()],
    timestamp: Date.now(),
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.customId?.startsWith('help:') &&
      (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit())) {
    return require('./utils/help-menu').handleHelpInteraction(interaction);
  }
  if (interaction.customId?.startsWith('welcome_') &&
      (interaction.isButton() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isModalSubmit())) {
    return require('./systems/welcome').handleWelcomeInteraction(interaction);
  }
  if (interaction.customId?.startsWith('ticket_') &&
      (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()
        || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu())) {
    const { handleTicketInteraction } = require('./systems/tickets');
    return handleTicketInteraction(interaction);
  }
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('rm_')) {
      const parts = interaction.customId.split('_');
      const roleId = parts[2];
      const member = interaction.member;
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
        return interaction.reply({ content: `Role <@&${roleId}> retire.`, ephemeral: true });
      } else {
        await member.roles.add(roleId).catch(() => {});
        return interaction.reply({ content: `Role <@&${roleId}> ajoute.`, ephemeral: true });
      }
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rms_')) {
    const selected = interaction.values;
    const member = interaction.member;
    const { db } = require('./database');
    const menuId = parseInt(interaction.customId.split('_')[1]);
    const allRoles = db.prepare('SELECT role_id FROM rolemenu_roles WHERE menu_id = ?').all(menuId);

    const added = [];
    const removed = [];

    for (const r of allRoles) {
      if (selected.includes(r.role_id)) {
        if (!member.roles.cache.has(r.role_id)) {
          await member.roles.add(r.role_id).catch(() => {});
          added.push(r.role_id);
        }
      } else {
        if (member.roles.cache.has(r.role_id)) {
          await member.roles.remove(r.role_id).catch(() => {});
          removed.push(r.role_id);
        }
      }
    }

    const parts = [];
    if (added.length) parts.push(`✅ Ajoute: ${added.map(r => `<@&${r}>`).join(', ')}`);
    if (removed.length) parts.push(`❌ Retire: ${removed.map(r => `<@&${r}>`).join(', ')}`);

    return interaction.reply({ content: parts.join('\n') || 'Aucun changement.', ephemeral: true });
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const { handleWelcome } = require('./systems/welcome');
  handleWelcome(member).catch(err => console.error('Bienvenue :', err.message));

  const { db } = require('./database');
  const stickies = db.prepare('SELECT role_id FROM sticky_roles WHERE user_id = ? AND guild_id = ?').all(member.id, member.guild.id);
  for (const s of stickies) {
    member.roles.add(s.role_id).catch(() => {});
  }

  const { trackInvite } = require('./systems/invites');
  trackInvite(member);
});

client.on(Events.GuildMemberRemove, (member) => {
  const { handleMemberLeave } = require('./systems/invites');
  handleMemberLeave(member);
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    const { db } = require('./database');
    const lock = db.prepare('SELECT locked_name FROM locknames WHERE user_id = ? AND guild_id = ?').get(newMember.id, newMember.guild.id);
    if (lock && newMember.nickname !== lock.locked_name) {
      newMember.setNickname(lock.locked_name).catch(() => {});
    }
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const { handleVoicePerso } = require('./systems/vocaux-perso');
  handleVoicePerso(oldState, newState, client);

  const { handleFollow } = require('./systems/follow');
  handleFollow(oldState, newState, client);
});

client.on(Events.InviteCreate, (invite) => {
  const { cacheInvites } = require('./systems/invites');
  cacheInvites(invite.guild);
});

client.on(Events.InviteDelete, (invite) => {
  const { cacheInvites } = require('./systems/invites');
  cacheInvites(invite.guild);
});

const http = require('http');
http.createServer((_, res) => { res.writeHead(200); res.end('OK'); }).listen(process.env.PORT || 3000);

client.login(config.token);
