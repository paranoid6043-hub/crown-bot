const { db } = require('../../database');
const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'lockname',
  description: 'Verrouille le pseudo d\'un membre',
  usage: '&lockname <@user>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [error('Membre introuvable.')] });

    db.prepare('INSERT OR REPLACE INTO locknames (user_id, guild_id, locked_name) VALUES (?, ?, ?)').run(userId, message.guild.id, member.displayName);

    logMod(message.guild, { action: 'Lockname', moderator: message.author, target: member.user, extra: `Pseudo verrouille: ${member.displayName}` });

    message.reply({ embeds: [success(`Pseudo de ${member.user.tag} verrouille sur **${member.displayName}**.`)] });
  },
};
