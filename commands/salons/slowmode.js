const { parseChannel, parseDuration } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'slowmode',
  description: 'Mode lent (ex: 10s, 5m, 1h, off)',
  usage: '&slowmode <duree|off> [#salon]',
  permission: 'Sys',
  category: 'Salons',

  async execute(message, args) {
    if (!args[0]) return message.reply({ embeds: [E.error('`&slowmode <duree|off> [#salon]`')] });

    const channelId = parseChannel(args[1]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
    if (!channel) return message.reply({ embeds: [E.error('Salon introuvable.')] });

    if (args[0].toLowerCase() === 'off') {
      await channel.setRateLimitPerUser(0);
      return message.reply({ embeds: [E.success(`Slowmode desactive dans ${channel}.`)] });
    }

    const ms = parseDuration(args[0]);
    if (!ms) return message.reply({ embeds: [E.error('Duree invalide (ex: 10s, 5m, 1h).')] });

    const seconds = Math.min(Math.floor(ms / 1000), 21600);
    await channel.setRateLimitPerUser(seconds);
    return message.reply({ embeds: [E.success(`Slowmode defini a **${seconds}s** dans ${channel}.`)] });
  },
};
