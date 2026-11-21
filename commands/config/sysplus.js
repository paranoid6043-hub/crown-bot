const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { getUserLevel, setUserLevel } = require('../../utils/permissions');

module.exports = {
  name: 'sys+',
  description: 'Toggle le niveau Sys+',
  usage: '&sys+ <@user>',
  permission: 'Sys+',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const current = getUserLevel(userId, message.guild);
    if (current === 'Sys+') {
      setUserLevel(userId, message.guild.id, 'Public');
      return message.reply({ embeds: [E.success(`<@${userId}> n'est plus **Sys+**.`)] });
    }

    setUserLevel(userId, message.guild.id, 'Sys+');
    return message.reply({ embeds: [E.success(`<@${userId}> est maintenant **Sys+** 👑.`)] });
  },
};
