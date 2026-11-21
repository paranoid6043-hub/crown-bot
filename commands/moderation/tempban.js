const { db } = require('../../database');
const { success, error } = require('../../utils/embeds');
const { parseUser, parseDuration, formatDuration } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'tempban',
  description: 'Bannit temporairement un membre',
  usage: '&tempban <@user> <duree> [raison]',
  permission: 'Sys+',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const duration = parseDuration(args[1]);
    if (!duration) return message.reply({ embeds: [error('Duree invalide. Ex: 1h, 1d, 1sem')] });

    const reason = args.slice(2).join(' ') || 'Aucune raison';
    const member = await message.guild.members.fetch(userId).catch(() => null);

    await member?.send(`🔨 Tu as ete banni temporairement de **${message.guild.name}** pour ${formatDuration(duration)}\nRaison: ${reason}`).catch(() => {});

    await message.guild.members.ban(userId, { reason }).catch(() => {
      return message.reply({ embeds: [error('Impossible de bannir ce membre.')] });
    });

    const expiresAt = Date.now() + duration;
    db.prepare('INSERT INTO tempbans (user_id, guild_id, moderator_id, reason, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, message.guild.id, message.author.id, reason, expiresAt, new Date().toISOString());
    db.prepare('INSERT INTO sanctions (user_id, guild_id, type, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, message.guild.id, 'tempban', message.author.id, reason, new Date().toISOString());

    logMod(message.guild, { action: 'Tempban', moderator: message.author, target: `<@${userId}>`, reason, duration: formatDuration(duration) });

    message.reply({ embeds: [success(`<@${userId}> a ete banni pour ${formatDuration(duration)}. Raison: ${reason}`)] });
  },
};
