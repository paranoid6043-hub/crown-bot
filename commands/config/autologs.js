const { EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');
const { success, error } = require('../../utils/embeds');

const LOG_CHANNELS = [
  { key: 'mod_channel', name: '📋・logs-modération', desc: 'Ban, kick, timeout, warns' },
  { key: 'messages_channel', name: '💬・logs-messages', desc: 'Messages supprimés et modifiés' },
  { key: 'voice_channel', name: '🎙️・logs-vocal', desc: 'Connexions et déconnexions vocales' },
  { key: 'members_channel', name: '👥・logs-membres', desc: 'Arrivées et départs' },
  { key: 'server_channel', name: '⚙️・logs-serveur', desc: 'Salons créés, supprimés, modifiés' },
  { key: 'roles_channel', name: '🏷️・logs-rôles', desc: 'Rôles créés, supprimés, modifiés' },
];

module.exports = {
  name: 'autologs',
  description: 'Crée automatiquement tous les salons de logs',
  usage: '&autologs [off]',
  permission: 'Sys+',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    if (args[0]?.toLowerCase() === 'off') {
      db.prepare('DELETE FROM logs_config WHERE guild_id = ?').run(message.guild.id);
      return message.reply({ embeds: [success('Tous les logs ont été désactivés.')] });
    }

    const loading = await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.accentColor)
        .setDescription('⏳ Création des salons de logs en cours...')],
    });

    const category = await message.guild.channels.create({
      name: '📜 Logs',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: message.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: message.guild.members.me.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.EmbedLinks,
          ],
        },
      ],
    }).catch(() => null);

    if (!category) {
      return loading.edit({ embeds: [error('Impossible de créer la catégorie. Vérifie mes permissions.')] });
    }

    const channelIds = {};

    for (const log of LOG_CHANNELS) {
      const ch = await message.guild.channels.create({
        name: log.name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: log.desc,
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: message.guild.members.me.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.EmbedLinks,
            ],
          },
        ],
      }).catch(() => null);

      if (ch) channelIds[log.key] = ch.id;
    }

    const fields = Object.keys(channelIds);
    if (!fields.length) {
      return loading.edit({ embeds: [error('Impossible de créer les salons. Vérifie mes permissions.')] });
    }

    const cols = fields.join(', ');
    const placeholders = fields.map(() => '?').join(', ');
    const updateSet = fields.map(f => `${f} = excluded.${f}`).join(', ');
    const values = fields.map(f => channelIds[f]);

    db.prepare(`INSERT INTO logs_config (guild_id, ${cols}) VALUES (?, ${placeholders}) ON CONFLICT (guild_id) DO UPDATE SET ${updateSet}`).run(message.guild.id, ...values);

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle('📜 Autologs — Salons créés')
      .setDescription('Tous les salons de logs ont été créés et configurés automatiquement.')
      .setFooter({ text: 'Les salons sont visibles uniquement par le bot et les admins' });

    for (const log of LOG_CHANNELS) {
      if (channelIds[log.key]) {
        embed.addFields({ name: log.desc, value: `<#${channelIds[log.key]}>`, inline: true });
      }
    }

    await loading.edit({ embeds: [embed] });
  },
};
