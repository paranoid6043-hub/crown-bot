const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { addFollow } = require('../../systems/follow');

module.exports = {
  name: 'laisse',
  description: 'Laisse 30 min : si tu bouges, elle bouge',
  usage: '&laisse <@user>',
  permission: 'Sys',
  category: 'Suivi & Laisse',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const expires = Date.now() + 30 * 60 * 1000;
    addFollow.run(message.guild.id, message.author.id, userId, 'laisse', expires);

    return message.reply({ embeds: [E.success(`**${target.displayName}** est en laisse pendant 30 minutes. Si tu bouges, elle bouge.`)] });
  },
};
