const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'mv',
  description: 'Amene la cible dans ton vocal',
  usage: '&mv <@user>',
  permission: 'Sys',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const author = message.guild.members.cache.get(message.author.id);
    if (!author?.voice.channel) return message.reply({ embeds: [E.error('Tu dois etre en vocal.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target?.voice.channel) return message.reply({ embeds: [E.error('Cette personne n\'est pas en vocal.')] });

    await target.voice.setChannel(author.voice.channel);
    return message.reply({ embeds: [E.success(`**${target.displayName}** a ete deplace dans ton vocal.`)] });
  },
};
