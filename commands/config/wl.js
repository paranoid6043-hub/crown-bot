const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { getUserLevel, setUserLevel } = require('../../utils/permissions');

module.exports = {
  name: 'wl',
  description: 'Toggle le niveau WL',
  usage: '&wl <@user>',
  permission: 'Owner',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const current = getUserLevel(userId, message.guild);
    if (current === 'WL') {
      setUserLevel(userId, message.guild.id, 'Public');
      return message.reply({ embeds: [E.success(`<@${userId}> n'est plus **WL**.`)] });
    }

    setUserLevel(userId, message.guild.id, 'WL');
    return message.reply({ embeds: [E.success(`<@${userId}> est maintenant **WL** ✅.`)] });
  },
};
