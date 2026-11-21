const { parseUser, parseDuration, formatDuration } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'watch',
  description: 'Surveillance : alertes vocal, pseudo, liens',
  usage: '&watch <@user> [duree] [@contact]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    if (args.length === 0) {
      const watched = db.prepare('SELECT * FROM watched WHERE guild_id = ?').all(message.guild.id);
      if (watched.length === 0) return message.reply({ embeds: [E.info('Aucune surveillance active.')] });

      const lines = watched.map(w => {
        const exp = w.expires_at ? `<t:${Math.floor(w.expires_at / 1000)}:R>` : 'Indefini';
        return `👁️ <@${w.user_id}> — Expire: ${exp}${w.contact_id ? ` — Contact: <@${w.contact_id}>` : ''}`;
      });
      return message.reply({ embeds: [E.embed().setTitle('👁️ Surveillances').setDescription(lines.join('\n'))] });
    }

    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('`&watch <@user> [duree] [@contact]`')] });

    const existing = db.prepare('SELECT * FROM watched WHERE user_id = ? AND guild_id = ?').get(userId, message.guild.id);
    if (existing && args.length === 1) {
      db.prepare('DELETE FROM watched WHERE user_id = ? AND guild_id = ?').run(userId, message.guild.id);
      return message.reply({ embeds: [E.success(`Surveillance retiree pour <@${userId}>.`)] });
    }

    const duration = parseDuration(args[1]);
    const expiresAt = duration ? Date.now() + duration : null;
    const contactId = parseUser(args[2], message) || null;

    db.prepare(`
      INSERT INTO watched (user_id, guild_id, contact_id, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET contact_id = excluded.contact_id, expires_at = excluded.expires_at
    `).run(userId, message.guild.id, contactId, expiresAt);

    return message.reply({ embeds: [E.success(`<@${userId}> est maintenant surveille.${duration ? ` Duree: ${formatDuration(duration)}` : ''}${contactId ? ` Contact: <@${contactId}>` : ''}`)] });
  },
};
