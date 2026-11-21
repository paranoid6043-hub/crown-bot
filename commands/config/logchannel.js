const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const { parseChannel } = require('../../utils/parsers');

module.exports = {
  name: 'logchannel',
  aliases: ['logs', 'setlogs'],
  description: 'Configure les salons de logs',
  usage: '&logchannel mod #salon | &logchannel internal #salon | &logchannel off',
  permission: 'Sys+',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const type = args[0]?.toLowerCase();

    if (type === 'off') {
      db.prepare('DELETE FROM logs_config WHERE guild_id = ?').run(message.guild.id);
      return message.reply({ embeds: [success('Logs desactives.')] });
    }

    if (type === 'mod') {
      const channelId = parseChannel(args[1]);
      if (!channelId) return message.reply({ embeds: [error('Mentionne un salon.')] });
      db.prepare('INSERT INTO logs_config (guild_id, mod_channel) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET mod_channel = excluded.mod_channel').run(message.guild.id, channelId);
      return message.reply({ embeds: [success(`Logs de moderation dans <#${channelId}>.`)] });
    }

    if (type === 'internal') {
      const channelId = parseChannel(args[1]);
      if (!channelId) return message.reply({ embeds: [error('Mentionne un salon.')] });
      db.prepare('INSERT INTO logs_config (guild_id, internal_channel) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET internal_channel = excluded.internal_channel').run(message.guild.id, channelId);
      return message.reply({ embeds: [success(`Logs internes dans <#${channelId}>.`)] });
    }

    message.reply({ embeds: [info('`&logchannel mod #salon` — Logs de moderation\n`&logchannel internal #salon` — Logs internes du bot\n`&logchannel off` — Desactiver')] });
  },
};
