const { parseDuration, formatDuration } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'remind',
  description: 'Rappel en MP',
  usage: '&remind <duree> <texte> | &remind list | &remind delete <n>',
  permission: 'Public',
  category: 'Niveaux & Configuration',

  async execute(message, args, client) {
    if (args[0] === 'list') {
      const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at').all(message.author.id);
      if (reminders.length === 0) return message.reply({ embeds: [E.info('Aucun rappel.')] });

      const lines = reminders.map((r, i) => `**${i + 1}.** ${r.message} — <t:${Math.floor(r.remind_at / 1000)}:R>`);
      return message.reply({ embeds: [E.embed().setTitle('⏰ Tes rappels').setDescription(lines.join('\n'))] });
    }

    if (args[0] === 'delete') {
      const idx = parseInt(args[1]) - 1;
      const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at').all(message.author.id);
      if (idx < 0 || idx >= reminders.length) return message.reply({ embeds: [E.error('Index invalide.')] });

      db.prepare('DELETE FROM reminders WHERE id = ?').run(reminders[idx].id);
      return message.reply({ embeds: [E.success('Rappel supprime.')] });
    }

    const duration = parseDuration(args[0]);
    if (!duration) return message.reply({ embeds: [E.error('`&remind <duree> <texte>`')] });

    const text = args.slice(1).join(' ');
    if (!text) return message.reply({ embeds: [E.error('Indique un texte.')] });

    const remindAt = Date.now() + duration;
    db.prepare('INSERT INTO reminders (user_id, guild_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?, ?)')
      .run(message.author.id, message.guild.id, message.channel.id, text, remindAt);

    setTimeout(async () => {
      try {
        await message.author.send({ embeds: [
          E.embed().setTitle('⏰ Rappel').setDescription(text).setTimestamp(),
        ] });
      } catch {
        const ch = client.channels.cache.get(message.channel.id);
        if (ch) ch.send({ content: `${message.author}`, embeds: [E.embed().setTitle('⏰ Rappel').setDescription(text)] }).catch(() => {});
      }
      db.prepare('DELETE FROM reminders WHERE user_id = ? AND remind_at = ?').run(message.author.id, remindAt);
    }, duration);

    return message.reply({ embeds: [E.success(`Rappel dans **${formatDuration(duration)}** : ${text}`)] });
  },
};
