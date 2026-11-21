const { success, error } = require('../../utils/embeds');
const { parseUser, parseChannel } = require('../../utils/parsers');

module.exports = {
  name: 'uncmute',
  description: 'Unmute un membre dans un salon specifique',
  usage: '&uncmute <@user> [#salon]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const channelId = parseChannel(args[1]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

    await channel.permissionOverwrites.edit(userId, { SendMessages: null }).catch(() => {});

    message.reply({ embeds: [success(`<@${userId}> unmute dans ${channel}.`)] });
  },
};
