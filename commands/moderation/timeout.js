const { parseUser, parseDuration, formatDuration } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'timeout',
  description: 'Timeout un membre',
  usage: '&timeout <@user> <duree> [raison]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('`&timeout <@user> <duree> [raison]`')] });

    const duration = parseDuration(args[1]);
    if (!duration) return message.reply({ embeds: [E.error('Duree invalide (ex: 30s, 5m, 1h, 1d).')] });

    const reason = args.slice(2).join(' ') || 'Aucune raison';
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });
    if (!member.moderatable) return message.reply({ embeds: [E.error('Je ne peux pas timeout ce membre.')] });

    await member.timeout(duration, reason);

    db.prepare('INSERT INTO sanctions (user_id, guild_id, moderator_id, type, reason, duration) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, message.guild.id, message.author.id, 'timeout', reason, formatDuration(duration));

    const embed = E.embed()
      .setTitle('⏱️ Timeout')
      .setColor(0xFFA500)
      .addFields(
        { name: 'Membre', value: `<@${userId}>`, inline: true },
        { name: 'Duree', value: formatDuration(duration), inline: true },
        { name: 'Moderateur', value: `${message.author}`, inline: true },
        { name: 'Raison', value: reason },
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
