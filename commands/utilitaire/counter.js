const { ChannelType } = require('discord.js');
const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');

module.exports = {
  name: 'counter',
  aliases: ['compteur'],
  description: 'Compteurs de serveur',
  usage: '&counter add <type> [template] | &counter list | &counter remove <id>',
  permission: 'Sys+',
  category: 'Utilitaire',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'add') {
      const type = args[1]?.toLowerCase();
      const validTypes = ['members', 'humans', 'bots', 'roles', 'channels', 'online'];
      if (!validTypes.includes(type)) return message.reply({ embeds: [error(`Types valides: ${validTypes.join(', ')}`)] });

      const template = args.slice(2).join(' ') || `${type}: {count}`;

      const counts = {
        members: message.guild.memberCount,
        humans: message.guild.members.cache.filter(m => !m.user.bot).size,
        bots: message.guild.members.cache.filter(m => m.user.bot).size,
        roles: message.guild.roles.cache.size,
        channels: message.guild.channels.cache.size,
        online: message.guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
      };

      const name = template.replace('{count}', counts[type]);
      const channel = await message.guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [{ id: message.guild.id, deny: ['Connect'] }],
      });

      db.prepare('INSERT INTO counters (guild_id, channel_id, type, template) VALUES (?, ?, ?, ?)').run(message.guild.id, channel.id, type, template);

      return message.reply({ embeds: [success(`Compteur **${type}** cree : ${channel}`)] });
    }

    if (sub === 'list') {
      const counters = db.prepare('SELECT * FROM counters WHERE guild_id = ?').all(message.guild.id);
      if (counters.length === 0) return message.reply({ embeds: [info('Aucun compteur.')] });

      const list = counters.map(c => `**#${c.id}** — ${c.type} (<#${c.channel_id}>)`).join('\n');
      return message.reply({ embeds: [info(`📈 **Compteurs**\n\n${list}`)] });
    }

    if (sub === 'remove') {
      const id = parseInt(args[1]);
      const counter = db.prepare('SELECT * FROM counters WHERE id = ? AND guild_id = ?').get(id, message.guild.id);
      if (!counter) return message.reply({ embeds: [error('Compteur introuvable.')] });

      const ch = message.guild.channels.cache.get(counter.channel_id);
      if (ch) await ch.delete().catch(() => {});
      db.prepare('DELETE FROM counters WHERE id = ?').run(id);

      return message.reply({ embeds: [success('Compteur supprime.')] });
    }

    message.reply({ embeds: [info('`&counter add <type> [template]` — Types: members, humans, bots, roles, channels, online\n`&counter list` — Lister\n`&counter remove <id>` — Supprimer\n\nTemplate: `Membres: {count}`')] });
  },
};
