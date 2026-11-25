const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antimention',
  description: 'Configure l\'anti mass-mention',
  usage: '&antimention <on|off> [limite] [action] [durée_min]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info(
        '`&antimention on [limite] [action] [durée]`\n' +
        '`&antimention off`\n\n' +
        '**Actions:** `timeout` (défaut), `kick`, `ban`\n' +
        '**Exemples:**\n' +
        '`&antimention on 5` — timeout si 5+ mentions\n' +
        '`&antimention on 3 kick` — kick si 3+ mentions\n' +
        '`&antimention on 5 timeout 10` — timeout 10min si 5+ mentions'
      )] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antimention) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antimention = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Anti-mention désactivé.')] });
    }

    const limit = Math.max(2, parseInt(args[1]) || 5);
    const sanctionAction = ['timeout', 'kick', 'ban'].includes(args[2]?.toLowerCase()) ? args[2].toLowerCase() : 'timeout';
    const duration = Math.max(1, parseInt(args[3]) || 10);

    db.prepare(`INSERT INTO antiraid_config (guild_id, antimention, antimention_limit, antimention_action, antimention_duration)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET
        antimention = 1,
        antimention_limit = excluded.antimention_limit,
        antimention_action = excluded.antimention_action,
        antimention_duration = excluded.antimention_duration
    `).run(message.guild.id, 1, limit, sanctionAction, duration);

    const actionText = sanctionAction === 'timeout' ? `timeout ${duration}min` : sanctionAction;
    return message.reply({ embeds: [success(`Anti-mention activé : ${actionText} si ${limit}+ mentions.`)] });
  },
};
