const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antilink',
  description: 'Configure l\'antilink',
  usage: '&antilink <on|off> [action] [durée_min]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info(
        '`&antilink on [action] [durée]`\n' +
        '`&antilink off`\n\n' +
        '**Actions:** `delete` (défaut), `timeout`, `kick`, `ban`\n' +
        '**Exemples:**\n' +
        '`&antilink on` — supprime les liens\n' +
        '`&antilink on timeout 5` — supprime + timeout 5min\n' +
        '`&antilink on kick` — supprime + kick'
      )] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antilink) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antilink = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Antilink désactivé.')] });
    }

    const linkAction = ['delete', 'timeout', 'kick', 'ban'].includes(args[1]?.toLowerCase()) ? args[1].toLowerCase() : 'delete';
    const duration = Math.max(1, parseInt(args[2]) || 5);

    db.prepare(`INSERT INTO antiraid_config (guild_id, antilink, antilink_action, antilink_duration)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET
        antilink = 1,
        antilink_action = excluded.antilink_action,
        antilink_duration = excluded.antilink_duration
    `).run(message.guild.id, 1, linkAction, duration);

    const actionText = linkAction === 'delete' ? 'suppression' : linkAction === 'timeout' ? `timeout ${duration}min` : linkAction;
    return message.reply({ embeds: [success(`Antilink activé (action: ${actionText}).`)] });
  },
};
