const { db } = require('../../database');
const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');

module.exports = {
  name: 'unlockname',
  description: 'Deverrouille le pseudo d\'un membre',
  usage: '&unlockname <@user>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const r = db.prepare('DELETE FROM locknames WHERE user_id = ? AND guild_id = ?').run(userId, message.guild.id);
    if (!r.changes) return message.reply({ embeds: [error('Ce membre n\'a pas le pseudo verrouille.')] });

    message.reply({ embeds: [success(`Pseudo de <@${userId}> deverrouille.`)] });
  },
};
