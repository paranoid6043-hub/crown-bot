const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'pvlist',
  description: 'Liste des vocaux PV actifs',
  usage: '&pvlist',
  permission: 'Sys',
  category: 'Vocaux prives (PV)',

  async execute(message) {
    const pvs = db.prepare('SELECT * FROM private_vocals WHERE guild_id = ?').all(message.guild.id);

    if (pvs.length === 0) return message.reply({ embeds: [E.info('Aucun vocal prive actif.')] });

    const lines = pvs.map(p => {
      const ch = message.guild.channels.cache.get(p.channel_id);
      return `🔒 ${ch ? ch.name : p.channel_id} — Proprio: <@${p.owner_id}>`;
    });

    return message.reply({ embeds: [E.embed().setTitle('🔒 Vocaux prives').setDescription(lines.join('\n'))] });
  },
};
