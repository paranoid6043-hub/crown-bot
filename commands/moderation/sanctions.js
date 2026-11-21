const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'sanctions',
  description: 'Historique des timeouts, bans, kicks et mutes',
  usage: '&sanctions [@user|ID]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0], message) || message.author.id;
    const sanctions = db.prepare('SELECT * FROM sanctions WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 15')
      .all(userId, message.guild.id);

    if (sanctions.length === 0) {
      return message.reply({ embeds: [E.info(`<@${userId}> n'a aucune sanction.`)] });
    }

    const typeEmoji = { timeout: '⏱️', ban: '🔨', kick: '👢', mute: '🔇' };

    const lines = sanctions.map(s =>
      `${typeEmoji[s.type] || '📋'} **${s.type.toUpperCase()}** — ${s.reason || 'N/A'}${s.duration ? ` (${s.duration})` : ''}\n└ Par <@${s.moderator_id}> — ${s.created_at}`
    );

    const embed = E.embed()
      .setTitle(`📋 Sanctions de <@${userId}>`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${sanctions.length} sanction(s)` });

    return message.reply({ embeds: [embed] });
  },
};
