const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'anticaps',
  description: 'Configure l\'anti-majuscules',
  usage: '&anticaps <on|off> [ratio%]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info('`&anticaps on [ratio]` ou `&anticaps off`\nEx: `&anticaps on 70` = supprime si 70%+ de majuscules')] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, anticaps) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET anticaps = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Anti-majuscules désactivé.')] });
    }

    const ratio = Math.min(100, Math.max(50, parseInt(args[1]) || 70)) / 100;
    db.prepare('INSERT INTO antiraid_config (guild_id, anticaps, anticaps_ratio) VALUES (?, ?, ?) ON CONFLICT (guild_id) DO UPDATE SET anticaps = 1, anticaps_ratio = excluded.anticaps_ratio').run(message.guild.id, 1, ratio);
    return message.reply({ embeds: [success(`Anti-majuscules activé : suppression si ${Math.round(ratio * 100)}%+ de caps.`)] });
  },
};
