const { parseChannel } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'salonstaff',
  description: 'Salon des preuves et des alertes',
  usage: '&salonstaff #salon',
  permission: 'Sys+',
  category: 'Moderation',

  async execute(message, args) {
    const channelId = parseChannel(args[0]);
    if (!channelId) return message.reply({ embeds: [E.error('`&salonstaff #salon`')] });

    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) return message.reply({ embeds: [E.error('Salon introuvable.')] });

    db.prepare(`
      INSERT INTO staff_config (guild_id, staff_channel_id)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET staff_channel_id = excluded.staff_channel_id
    `).run(message.guild.id, channelId);

    return message.reply({ embeds: [E.success(`Salon staff defini sur ${channel}.`)] });
  },
};
