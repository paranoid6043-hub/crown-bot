const { PermissionsBitField } = require('discord.js');
const E = require('../../utils/embeds');
const { db } = require('../../database');

const getPV = db.prepare('SELECT * FROM private_vocals WHERE channel_id = ?');
const addPV = db.prepare('INSERT OR REPLACE INTO private_vocals (channel_id, guild_id, owner_id) VALUES (?, ?, ?)');
const removePV = db.prepare('DELETE FROM private_vocals WHERE channel_id = ?');

module.exports = {
  name: 'pv',
  description: 'Toggle PV sur ton vocal actuel',
  usage: '&pv',
  permission: 'Sys',
  category: 'Vocaux prives (PV)',

  async execute(message) {
    const member = message.guild.members.cache.get(message.author.id);
    if (!member?.voice.channel) return message.reply({ embeds: [E.error('Tu dois etre en vocal.')] });

    const vc = member.voice.channel;
    const existing = getPV.get(vc.id);

    if (existing) {
      await vc.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: null });
      removePV.run(vc.id);
      return message.reply({ embeds: [E.success(`**${vc.name}** n'est plus prive.`)] });
    }

    await vc.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
    await vc.permissionOverwrites.edit(message.author.id, { Connect: true });
    addPV.run(vc.id, message.guild.id, message.author.id);
    return message.reply({ embeds: [E.success(`**${vc.name}** est maintenant prive. Utilise \`&acc @user\` pour donner acces.`)] });
  },
};
