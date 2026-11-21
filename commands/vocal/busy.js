const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

const getBusy = db.prepare('SELECT * FROM busy WHERE user_id = ? AND guild_id = ?');
const addBusy = db.prepare('INSERT OR IGNORE INTO busy (user_id, guild_id) VALUES (?, ?)');
const removeBusy = db.prepare('DELETE FROM busy WHERE user_id = ? AND guild_id = ?');

module.exports = {
  name: 'busy',
  description: 'Toggle mode occupe (intouchable)',
  usage: '&busy <@user>',
  permission: 'Sys',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const existing = getBusy.get(userId, message.guild.id);
    if (existing) {
      removeBusy.run(userId, message.guild.id);
      return message.reply({ embeds: [E.success(`**${member.displayName}** n'est plus en mode occupe.`)] });
    }

    addBusy.run(userId, message.guild.id);
    return message.reply({ embeds: [E.success(`**${member.displayName}** est maintenant en mode occupe (intouchable).`)] });
  },
};
