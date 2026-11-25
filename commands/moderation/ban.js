const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'ban',
  description: 'Bannit un membre',
  usage: '&ban <@user> [raison]',
  permission: 'Sys+',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('`&ban <@user> [raison]`')] });

    const reason = args.slice(1).join(' ') || 'Aucune raison';
    const member = await message.guild.members.fetch(userId).catch(() => null);

    if (member) {
      if (!member.bannable) return message.reply({ embeds: [E.error('Je ne peux pas bannir ce membre.')] });
      await member.ban({ reason });
    } else {
      await message.guild.members.ban(userId, { reason }).catch(() => {
        return message.reply({ embeds: [E.error('Impossible de bannir cet utilisateur.')] });
      });
    }

    db.prepare('INSERT INTO sanctions (user_id, guild_id, moderator_id, type, reason) VALUES (?, ?, ?, ?, ?)')
      .run(userId, message.guild.id, message.author.id, 'ban', reason);

    const embed = E.embed()
      .setTitle('🔨 Ban')
      .setColor(0xFF0000)
      .addFields(
        { name: 'Utilisateur', value: `<@${userId}>`, inline: true },
        { name: 'Moderateur', value: `${message.author}`, inline: true },
        { name: 'Raison', value: reason },
      )
      .setTimestamp();

    logMod(message.guild, { action: 'Ban', moderator: message.author, target: `<@${userId}>`, reason });

    return message.reply({ embeds: [embed] });
  },
};
