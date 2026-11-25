const { db } = require('../../database');
const { success, info } = require('../../utils/embeds');

module.exports = {
  name: 'antijoin',
  aliases: ['antimassjoin'],
  description: 'Protection anti mass-join (raid)',
  usage: '&antijoin <on|off> [limite] [secondes]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info('`&antijoin on [limite] [secondes]` ou `&antijoin off`\nEx: `&antijoin on 5 10` = kick si 5+ joins en 10s')] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antijoin) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antijoin = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Anti mass-join désactivé.')] });
    }

    const limit = Math.max(3, parseInt(args[1]) || 5);
    const time = Math.max(5, parseInt(args[2]) || 10);
    db.prepare('INSERT INTO antiraid_config (guild_id, antijoin, antijoin_limit, antijoin_time) VALUES (?, ?, ?, ?) ON CONFLICT (guild_id) DO UPDATE SET antijoin = 1, antijoin_limit = excluded.antijoin_limit, antijoin_time = excluded.antijoin_time').run(message.guild.id, 1, limit, time);
    return message.reply({ embeds: [success(`Anti mass-join activé : kick si ${limit}+ joins en ${time}s.`)] });
  },
};
