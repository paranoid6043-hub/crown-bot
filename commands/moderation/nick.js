const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'nick',
  description: 'Change le pseudo d\'un membre',
  usage: '&nick <@user> <nouveau pseudo>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const newNick = args.slice(1).join(' ');
    if (!newNick) return message.reply({ embeds: [error('Precise le nouveau pseudo.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [error('Membre introuvable.')] });

    const old = member.displayName;
    await member.setNickname(newNick).catch(() => {
      return message.reply({ embeds: [error('Impossible de changer le pseudo.')] });
    });

    logMod(message.guild, { action: 'Nick', moderator: message.author, target: member.user, extra: `${old} → ${newNick}` });

    message.reply({ embeds: [success(`Pseudo de ${member.user.tag} change en **${newNick}**.`)] });
  },
};
