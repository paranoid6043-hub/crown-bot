const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'untimeout',
  description: 'Retire le timeout',
  usage: '&untimeout <@user>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    await member.timeout(null);
    return message.reply({ embeds: [E.success(`Timeout retire pour **${member.displayName}**.`)] });
  },
};
