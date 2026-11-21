const { parseChannel } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'lock',
  description: 'Verrouille le salon',
  usage: '&lock [#salon] [raison]',
  permission: 'Sys',
  category: 'Salons',

  async execute(message, args) {
    const channelId = parseChannel(args[0]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
    const reason = (channelId ? args.slice(1) : args).join(' ') || null;

    if (!channel) return message.reply({ embeds: [E.error('Salon introuvable.')] });

    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });

    const embed = E.embed()
      .setTitle('🔒 Salon verrouille')
      .setColor(0xFF0000)
      .setDescription(`${channel} a ete verrouille.${reason ? `\n**Raison :** ${reason}` : ''}`)
      .setFooter({ text: `Par ${message.author.tag}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
