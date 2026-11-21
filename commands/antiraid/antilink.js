const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antilink',
  description: 'Configure l\'antilink',
  usage: '&antilink <on|off> [action]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info('`&antilink on [delete|timeout]` ou `&antilink off`')] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antilink) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antilink = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Antilink desactive.')] });
    }

    const linkAction = args[1]?.toLowerCase() === 'timeout' ? 'timeout' : 'delete';
    db.prepare('INSERT INTO antiraid_config (guild_id, antilink, antilink_action) VALUES (?, ?, ?) ON CONFLICT (guild_id) DO UPDATE SET antilink = 1, antilink_action = excluded.antilink_action').run(message.guild.id, 1, linkAction);
    return message.reply({ embeds: [success(`Antilink active (action: ${linkAction}).`)] });
  },
};
