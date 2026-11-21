const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'pvdelete',
  description: 'Supprime tous les PV',
  usage: '&pvdelete',
  permission: 'Sys',
  category: 'Vocaux prives (PV)',

  async execute(message) {
    const pvs = db.prepare('SELECT * FROM private_vocals WHERE guild_id = ?').all(message.guild.id);

    for (const pv of pvs) {
      const ch = message.guild.channels.cache.get(pv.channel_id);
      if (ch) {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: null }).catch(() => {});
      }
    }

    db.prepare('DELETE FROM private_vocals WHERE guild_id = ?').run(message.guild.id);
    return message.reply({ embeds: [E.success(`**${pvs.length}** vocaux prives supprimes.`)] });
  },
};
