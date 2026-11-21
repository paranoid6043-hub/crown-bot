const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'find',
  description: 'Trouve le vocal de la cible',
  usage: '&find <@user>',
  permission: 'WL',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    if (!member.voice.channel) {
      return message.reply({ embeds: [E.info(`**${member.displayName}** n'est pas en vocal.`)] });
    }

    return message.reply({ embeds: [E.success(`**${member.displayName}** est dans **${member.voice.channel.name}**.`)] });
  },
};
