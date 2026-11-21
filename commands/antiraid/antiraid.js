const { EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  name: 'antiraid',
  description: 'Affiche la configuration anti-raid',
  usage: '&antiraid',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message) {
    const cfg = db.prepare('SELECT * FROM antiraid_config WHERE guild_id = ?').get(message.guild.id);

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('🛡️ Configuration Anti-Raid')
      .addFields(
        { name: '🔇 Antispam', value: cfg?.antispam ? `✅ Actif (${cfg.antispam_limit || 5} msg / ${cfg.antispam_time || 5}s)` : '❌ Inactif', inline: true },
        { name: '🔗 Antilink', value: cfg?.antilink ? `✅ Actif (${cfg.antilink_action || 'delete'})` : '❌ Inactif', inline: true },
        { name: '📢 Anti-mention', value: cfg?.antimention ? `✅ Actif (${cfg.antimention_limit || 5} max)` : '❌ Inactif', inline: true },
      )
      .setFooter({ text: 'Utilisez &antispam, &antilink, &antimention pour configurer' });

    message.reply({ embeds: [e] });
  },
};
