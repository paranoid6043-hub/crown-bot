const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antimention',
  description: 'Configure l\'anti mass-mention',
  usage: '&antimention <on|off> [limit]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info('`&antimention on [limite]` ou `&antimention off`\nEx: `&antimention on 5` = mute si 5+ mentions')] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antimention) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antimention = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Anti-mention desactive.')] });
    }

    const limit = parseInt(args[1]) || 5;
    db.prepare('INSERT INTO antiraid_config (guild_id, antimention, antimention_limit) VALUES (?, ?, ?) ON CONFLICT (guild_id) DO UPDATE SET antimention = 1, antimention_limit = excluded.antimention_limit').run(message.guild.id, 1, limit);
    return message.reply({ embeds: [success(`Anti-mention active : mute si ${limit}+ mentions.`)] });
  },
};
