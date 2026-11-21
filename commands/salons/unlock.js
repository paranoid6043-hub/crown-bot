const { parseChannel } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'unlock',
  description: 'Rouvre le salon comme avant',
  usage: '&unlock [#salon]',
  permission: 'Sys',
  category: 'Salons',

  async execute(message, args) {
    const channelId = parseChannel(args[0]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

    if (!channel) return message.reply({ embeds: [E.error('Salon introuvable.')] });

    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });

    return message.reply({ embeds: [E.success(`${channel} a ete deverrouille.`)] });
  },
};
