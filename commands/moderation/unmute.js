const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'unmute',
  description: 'Unmute serveur',
  usage: '&unmute <@user>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });
    if (!member.voice.channel) return message.reply({ embeds: [E.error('Ce membre n\'est pas en vocal.')] });

    await member.voice.setMute(false);
    return message.reply({ embeds: [E.success(`**${member.displayName}** a ete unmute.`)] });
  },
};
