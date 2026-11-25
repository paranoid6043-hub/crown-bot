const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antiemoji',
  description: 'Configure l\'anti-emoji spam',
  usage: '&antiemoji <on|off> [limite]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info('`&antiemoji on [limite]` ou `&antiemoji off`\nEx: `&antiemoji on 8` = supprime si 8+ emojis')] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antiemoji) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antiemoji = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Anti-emoji désactivé.')] });
    }

    const limit = Math.max(3, parseInt(args[1]) || 10);
    db.prepare('INSERT INTO antiraid_config (guild_id, antiemoji, antiemoji_limit) VALUES (?, ?, ?) ON CONFLICT (guild_id) DO UPDATE SET antiemoji = 1, antiemoji_limit = excluded.antiemoji_limit').run(message.guild.id, 1, limit);
    return message.reply({ embeds: [success(`Anti-emoji activé : suppression si ${limit}+ emojis.`)] });
  },
};
