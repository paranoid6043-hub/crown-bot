const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antispam',
  description: 'Configure l\'antispam',
  usage: '&antispam <on|off> [limit] [secondes] [action] [durée_min]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info(
        '`&antispam on [limit] [secondes] [action] [durée]`\n' +
        '`&antispam off`\n\n' +
        '**Actions:** `timeout` (défaut), `kick`, `ban`\n' +
        '**Exemples:**\n' +
        '`&antispam on 5 5` — 5 msgs en 5s = timeout 5min\n' +
        '`&antispam on 3 5 kick` — 3 msgs en 5s = kick\n' +
        '`&antispam on 5 5 timeout 10` — 5 msgs en 5s = timeout 10min'
      )] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antispam) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antispam = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Antispam désactivé.')] });
    }

    const limit = Math.max(2, parseInt(args[1]) || 5);
    const time = Math.max(2, parseInt(args[2]) || 5);
    const sanctionAction = ['timeout', 'kick', 'ban'].includes(args[3]?.toLowerCase()) ? args[3].toLowerCase() : 'timeout';
    const duration = Math.max(1, parseInt(args[4]) || 5);

    db.prepare(`INSERT INTO antiraid_config (guild_id, antispam, antispam_limit, antispam_time, antispam_action, antispam_duration)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET
        antispam = 1,
        antispam_limit = excluded.antispam_limit,
        antispam_time = excluded.antispam_time,
        antispam_action = excluded.antispam_action,
        antispam_duration = excluded.antispam_duration
    `).run(message.guild.id, 1, limit, time, sanctionAction, duration);

    const actionText = sanctionAction === 'timeout' ? `timeout ${duration}min` : sanctionAction;
    return message.reply({ embeds: [success(`Antispam activé : ${limit} messages en ${time}s → ${actionText}.`)] });
  },
};
