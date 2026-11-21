const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'addrole',
  description: 'Ajoute un role a un membre',
  usage: '&addrole <@user> <@role> [raison]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!role) return message.reply({ embeds: [error('Mentionne un role.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [error('Membre introuvable.')] });

    if (role.position >= message.guild.members.me.roles.highest.position) {
      return message.reply({ embeds: [error('Ce role est trop haut pour moi.')] });
    }

    const reason = args.slice(2).join(' ') || undefined;
    await member.roles.add(role, reason).catch(() => {});

    logMod(message.guild, { action: 'Addrole', moderator: message.author, target: member.user, extra: `Role: ${role.name}`, reason });

    message.reply({ embeds: [success(`Role ${role} ajoute a ${member}.`)] });
  },
};
