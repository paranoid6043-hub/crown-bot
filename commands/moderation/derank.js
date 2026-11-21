const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'derank',
  description: 'Retire tous les roles d\'un membre',
  usage: '&derank <@user>',
  permission: 'Sys+',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [error('Membre introuvable.')] });

    const roles = member.roles.cache.filter(r => r.id !== message.guild.id && r.position < message.guild.members.me.roles.highest.position);
    if (roles.size === 0) return message.reply({ embeds: [error('Aucun role a retirer.')] });

    await member.roles.remove(roles).catch(() => {});

    logMod(message.guild, { action: 'Derank', moderator: message.author, target: member.user, extra: `${roles.size} roles retires` });

    message.reply({ embeds: [success(`${roles.size} roles retires de ${member.user.tag}.`)] });
  },
};
