const { EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const config = require('../../config');

module.exports = {
  name: 'note',
  description: 'Ajoute ou liste les notes d\'un membre',
  usage: '&note <@user> [texte] | &note list <@user>',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    if (args[0]?.toLowerCase() === 'list') {
      const userId = parseUser(args[1]);
      if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

      const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC').all(userId, message.guild.id);
      if (notes.length === 0) return message.reply({ embeds: [info('Aucune note pour ce membre.')] });

      const list = notes.map((n, i) => `**#${i + 1}** par <@${n.moderator_id}> — ${n.content}`).join('\n');

      const e = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`📝 Notes de <@${userId}>`)
        .setDescription(list)
        .setFooter({ text: `${notes.length} note(s)` });

      return message.reply({ embeds: [e] });
    }

    const userId = parseUser(args[0]);
    if (!userId) return message.reply({ embeds: [error('Mentionne un membre.')] });

    const content = args.slice(1).join(' ');
    if (!content) return message.reply({ embeds: [error('Precise le contenu de la note.')] });

    db.prepare('INSERT INTO notes (user_id, guild_id, moderator_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, message.guild.id, message.author.id, content, new Date().toISOString());

    message.reply({ embeds: [success(`Note ajoutee pour <@${userId}>.`)] });
  },
};
