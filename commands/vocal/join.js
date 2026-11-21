const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'join',
  description: 'Te deplace vers le vocal de la cible',
  usage: '&join <@user>',
  permission: 'Owner',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target?.voice.channel) return message.reply({ embeds: [E.error('Cette personne n\'est pas en vocal.')] });

    const author = message.guild.members.cache.get(message.author.id);
    if (!author?.voice.channel) return message.reply({ embeds: [E.error('Tu dois etre en vocal.')] });

    await author.voice.setChannel(target.voice.channel);
    return message.reply({ embeds: [E.success(`Tu as rejoint **${target.voice.channel.name}**.`)] });
  },
};
