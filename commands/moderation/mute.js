const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'mute',
  description: 'Mute serveur en vocal',
  usage: '&mute <@user>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });
    if (!member.voice.channel) return message.reply({ embeds: [E.error('Ce membre n\'est pas en vocal.')] });

    await member.voice.setMute(true);

    db.prepare('INSERT INTO sanctions (user_id, guild_id, moderator_id, type, reason) VALUES (?, ?, ?, ?, ?)')
      .run(userId, message.guild.id, message.author.id, 'mute', 'Mute vocal');

    return message.reply({ embeds: [E.success(`**${member.displayName}** a ete mute en vocal.`)] });
  },
};
