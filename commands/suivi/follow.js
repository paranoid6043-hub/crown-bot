const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { addFollow } = require('../../systems/follow');

module.exports = {
  name: 'follow',
  description: 'Tu suis la cible (auto-move 30 min)',
  usage: '&follow <@user>',
  permission: 'Sys',
  category: 'Suivi & Laisse',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const expires = Date.now() + 30 * 60 * 1000;
    addFollow.run(message.guild.id, message.author.id, userId, 'follow', expires);

    return message.reply({ embeds: [E.success(`Tu suis maintenant **${target.displayName}** pendant 30 minutes.`)] });
  },
};
