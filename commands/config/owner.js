const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { getUserLevel, setUserLevel } = require('../../utils/permissions');

module.exports = {
  name: 'owner',
  description: 'Toggle le niveau Owner',
  usage: '&owner <@user>',
  permission: 'Sys',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const current = getUserLevel(userId, message.guild);
    if (current === 'Owner') {
      setUserLevel(userId, message.guild.id, 'Public');
      return message.reply({ embeds: [E.success(`<@${userId}> n'est plus **Owner**.`)] });
    }

    setUserLevel(userId, message.guild.id, 'Owner');
    return message.reply({ embeds: [E.success(`<@${userId}> est maintenant **Owner** 🔑.`)] });
  },
};
