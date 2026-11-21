const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

const getPunished = db.prepare('SELECT * FROM punished WHERE user_id = ? AND guild_id = ?');
const addPunished = db.prepare('INSERT OR IGNORE INTO punished (user_id, guild_id) VALUES (?, ?)');
const removePunished = db.prepare('DELETE FROM punished WHERE user_id = ? AND guild_id = ?');

module.exports = {
  name: 'punis',
  description: 'Toggle punition vocale (ne peut plus rejoindre)',
  usage: '&punis <@user>',
  permission: 'Sys+',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const existing = getPunished.get(userId, message.guild.id);
    if (existing) {
      removePunished.run(userId, message.guild.id);
      return message.reply({ embeds: [E.success(`**${member.displayName}** n'est plus puni.`)] });
    }

    addPunished.run(userId, message.guild.id);
    if (member.voice.channel) {
      await member.voice.disconnect().catch(() => {});
    }
    return message.reply({ embeds: [E.success(`**${member.displayName}** est maintenant puni (plus de vocal).`)] });
  },
};
