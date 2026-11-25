const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const { parseChannel } = require('../../utils/parsers');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

const TYPES = {
  mod: { col: 'mod_channel', label: 'Modération' },
  messages: { col: 'messages_channel', label: 'Messages' },
  voice: { col: 'voice_channel', label: 'Vocal' },
  members: { col: 'members_channel', label: 'Membres' },
  server: { col: 'server_channel', label: 'Serveur' },
  roles: { col: 'roles_channel', label: 'Rôles' },
  internal: { col: 'internal_channel', label: 'Interne' },
};

module.exports = {
  name: 'logchannel',
  aliases: ['logs', 'setlogs'],
  description: 'Configure les salons de logs',
  usage: '&logchannel <type> #salon | &logchannel off | &logchannel status',
  permission: 'Sys+',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const type = args[0]?.toLowerCase();

    if (type === 'off') {
      db.prepare('DELETE FROM logs_config WHERE guild_id = ?').run(message.guild.id);
      return message.reply({ embeds: [success('Tous les logs désactivés.')] });
    }

    if (!type || type === 'status') {
      const row = db.prepare('SELECT * FROM logs_config WHERE guild_id = ?').get(message.guild.id);
      if (!row) return message.reply({ embeds: [info('Aucun log configuré. Utilise `&autologs` pour tout créer automatiquement.')] });

      const e = new EmbedBuilder()
        .setColor(config.accentColor)
        .setTitle('📜 Configuration des logs');

      for (const [key, t] of Object.entries(TYPES)) {
        const channelId = row[t.col];
        e.addFields({
          name: t.label,
          value: channelId ? `<#${channelId}>` : '`❌` Non configuré',
          inline: true,
        });
      }

      e.setFooter({ text: '&autologs pour tout créer | &logchannel <type> #salon | &logchannel off' });
      return message.reply({ embeds: [e] });
    }

    const typeInfo = TYPES[type];
    if (!typeInfo) {
      const types = Object.keys(TYPES).join(', ');
      return message.reply({ embeds: [info(`Types disponibles: \`${types}\`\n\n\`&logchannel <type> #salon\` — configurer un type\n\`&logchannel off\` — tout désactiver\n\`&logchannel status\` — voir la config\n\`&autologs\` — tout créer automatiquement`)] });
    }

    const channelId = parseChannel(args[1]);
    if (!channelId) return message.reply({ embeds: [error('Mentionne un salon.')] });

    const col = typeInfo.col;
    db.prepare(`INSERT INTO logs_config (guild_id, ${col}) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET ${col} = excluded.${col}`).run(message.guild.id, channelId);
    return message.reply({ embeds: [success(`Logs **${typeInfo.label}** configurés dans <#${channelId}>.`)] });
  },
};
