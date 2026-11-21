const { PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const { parseUser, parseChannel } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'cmute',
  description: 'Mute un membre dans un salon specifique',
  usage: '&cmute <@user> [#salon] [raison]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const channelId = parseChannel(args[1]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
    const reason = args.slice(channelId ? 2 : 1).join(' ') || 'Aucune raison';

    await channel.permissionOverwrites.edit(userId, { SendMessages: false }, { reason }).catch(() => {});

    logMod(message.guild, { action: 'Channel Mute', moderator: message.author, target: `<@${userId}>`, extra: `Salon: ${channel}`, reason });

    message.reply({ embeds: [success(`<@${userId}> mute dans ${channel}.`)] });
  },
};
