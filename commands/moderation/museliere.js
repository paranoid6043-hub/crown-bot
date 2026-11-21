const { parseUser, parseDuration, formatDuration } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'museliere',
  aliases: ['msl'],
  description: 'Ses messages deviennent des moutons',
  usage: '&museliere <@user> [10m|off]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('`&museliere <@user> [duree|off]`')] });

    if (args[1] === 'off') {
      db.prepare('DELETE FROM museliere WHERE user_id = ? AND guild_id = ?').run(userId, message.guild.id);
      return message.reply({ embeds: [E.success(`Museliere retiree pour <@${userId}>.`)] });
    }

    const duration = parseDuration(args[1]);
    const expiresAt = duration ? Date.now() + duration : null;

    db.prepare(`
      INSERT INTO museliere (user_id, guild_id, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET expires_at = excluded.expires_at
    `).run(userId, message.guild.id, expiresAt);

    return message.reply({ embeds: [E.success(`🐑 <@${userId}> a maintenant une museliere.${duration ? ` Duree: ${formatDuration(duration)}` : ' Indefini.'}`)] });
  },
};
