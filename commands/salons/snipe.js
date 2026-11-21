const E = require('../../utils/embeds');

module.exports = {
  name: 'snipe',
  description: 'Affiche le dernier message supprime du salon',
  usage: '&snipe',
  permission: 'Public',
  category: 'Salons',

  async execute(message, args, client) {
    const snipe = client.snipes.get(message.channel.id);
    if (!snipe) return message.reply({ embeds: [E.info('Rien a snipe.')] });

    const embed = E.embed()
      .setAuthor({ name: snipe.author.tag, iconURL: snipe.author.displayAvatarURL() })
      .setDescription(snipe.content || '*Aucun texte*')
      .setFooter({ text: `Supprime` })
      .setTimestamp(snipe.timestamp);

    if (snipe.attachments.length > 0) {
      embed.setImage(snipe.attachments[0].proxyURL || snipe.attachments[0].url);
    }

    return message.reply({ embeds: [embed] });
  },
};
