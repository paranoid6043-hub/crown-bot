const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'kick',
  description: 'Expulse un membre',
  usage: '&kick <@user> [raison]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('`&kick <@user> [raison]`')] });

    const reason = args.slice(1).join(' ') || 'Aucune raison';
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });
    if (!member.kickable) return message.reply({ embeds: [E.error('Je ne peux pas kick ce membre.')] });

    await member.kick(reason);

    db.prepare('INSERT INTO sanctions (user_id, guild_id, moderator_id, type, reason) VALUES (?, ?, ?, ?, ?)')
      .run(userId, message.guild.id, message.author.id, 'kick', reason);

    const embed = E.embed()
      .setTitle('👢 Kick')
      .setColor(0xFF8C00)
      .addFields(
        { name: 'Membre', value: `${member.user.tag}`, inline: true },
        { name: 'Moderateur', value: `${message.author}`, inline: true },
        { name: 'Raison', value: reason },
      )
      .setTimestamp();

    logMod(message.guild, { action: 'Kick', moderator: message.author, target: member.user, reason });

    return message.reply({ embeds: [embed] });
  },
};
