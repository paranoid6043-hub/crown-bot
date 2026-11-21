const E = require('../../utils/embeds');

module.exports = {
  name: 'unban',
  description: 'Debannit un utilisateur',
  usage: '&unban <ID> [raison]',
  permission: 'Sys+',
  category: 'Moderation',

  async execute(message, args) {
    const userId = args[0];
    if (!userId || !/^\d{17,20}$/.test(userId)) return message.reply({ embeds: [E.error('`&unban <ID> [raison]`')] });

    const reason = args.slice(1).join(' ') || 'Aucune raison';

    try {
      await message.guild.members.unban(userId, reason);
      return message.reply({ embeds: [E.success(`<@${userId}> a ete debanni.`)] });
    } catch {
      return message.reply({ embeds: [E.error('Cet utilisateur n\'est pas banni.')] });
    }
  },
};
