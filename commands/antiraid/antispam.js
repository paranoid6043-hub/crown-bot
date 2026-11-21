const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');

module.exports = {
  name: 'antispam',
  description: 'Configure l\'antispam',
  usage: '&antispam <on|off> [limit] [secondes]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
      return message.reply({ embeds: [info('`&antispam on [limit] [secondes]` ou `&antispam off`\nEx: `&antispam on 5 5` = 5 messages en 5s = mute')] });
    }

    if (action === 'off') {
      db.prepare('INSERT INTO antiraid_config (guild_id, antispam) VALUES (?, ?) ON CONFLICT (guild_id) DO UPDATE SET antispam = 0').run(message.guild.id, 0);
      return message.reply({ embeds: [success('Antispam desactive.')] });
    }

    const limit = parseInt(args[1]) || 5;
    const time = parseInt(args[2]) || 5;
    db.prepare('INSERT INTO antiraid_config (guild_id, antispam, antispam_limit, antispam_time) VALUES (?, ?, ?, ?) ON CONFLICT (guild_id) DO UPDATE SET antispam = 1, antispam_limit = excluded.antispam_limit, antispam_time = excluded.antispam_time').run(message.guild.id, 1, limit, time);
    return message.reply({ embeds: [success(`Antispam active : ${limit} messages en ${time}s = mute 5min.`)] });
  },
};
