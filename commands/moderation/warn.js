const { db } = require('../../database');
const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'warn',
  description: 'Avertit un membre',
  usage: '&warn <@user> [raison]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [error('Membre introuvable.')] });

    const reason = args.slice(1).join(' ') || 'Aucune raison';

    db.prepare('INSERT INTO warns (user_id, guild_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, message.guild.id, message.author.id, reason, new Date().toISOString());
    db.prepare('INSERT INTO sanctions (user_id, guild_id, type, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, message.guild.id, 'warn', message.author.id, reason, new Date().toISOString());

    const count = db.prepare('SELECT * FROM warns WHERE user_id = ? AND guild_id = ?').all(userId, message.guild.id).length;

    await member.send(`⚠️ Tu as recu un avertissement sur **${message.guild.name}**\nRaison: ${reason}\nTotal warns: ${count}`).catch(() => {});

    logMod(message.guild, { action: 'Warn', moderator: message.author, target: member.user, reason });

    message.reply({ embeds: [success(`${member.user.tag} a ete averti (${count} warns). Raison: ${reason}`)] });
  },
};
