const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseDuration, formatDuration } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'giveaway',
  aliases: ['gw'],
  description: 'Systeme de giveaways',
  usage: '&giveaway [create|list|end|reroll|delete] [args]',
  permission: 'Sys',
  category: 'Giveaways',

  async execute(message, args, client) {
    const sub = (args[0] || 'create').toLowerCase();

    if (sub === 'create') {
      const embed = E.embed()
        .setTitle('🎉 Creer un giveaway')
        .setDescription('Reponds aux questions suivantes :');
      await message.reply({ embeds: [embed] });

      const ask = async (question) => {
        await message.channel.send(question);
        const collected = await message.channel.awaitMessages({
          filter: m => m.author.id === message.author.id,
          max: 1, time: 30_000,
        });
        return collected.first()?.content;
      };

      const prize = await ask('**Quel est le prix ?**');
      if (!prize) return message.channel.send({ embeds: [E.error('Temps ecoule.')] });

      const durationStr = await ask('**Duree ?** (ex: 1h, 1j, 1sem)');
      const duration = parseDuration(durationStr);
      if (!duration) return message.channel.send({ embeds: [E.error('Duree invalide.')] });

      const winnersStr = await ask('**Nombre de gagnants ?** (1-20)');
      const winners = Math.min(20, Math.max(1, parseInt(winnersStr) || 1));

      const endTime = Date.now() + duration;

      const gwEmbed = E.embed()
        .setTitle('🎉 GIVEAWAY')
        .setDescription(`**${prize}**\n\nReagis avec 🎉 pour participer !\n\n⏰ Fin: <t:${Math.floor(endTime / 1000)}:R>\n👥 Gagnants: **${winners}**\n🎯 Par: ${message.author}`)
        .setColor(0x5865F2)
        .setTimestamp(endTime);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gw_join').setLabel('Participer 🎉').setStyle(ButtonStyle.Primary),
      );

      const gwMsg = await message.channel.send({ embeds: [gwEmbed], components: [row] });

      const gwId = db.prepare('INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(message.guild.id, message.channel.id, gwMsg.id, message.author.id, prize, winners, endTime).lastInsertRowid;

      const collector = gwMsg.createMessageComponentCollector({ time: duration });

      collector.on('collect', async (i) => {
        const existing = db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(gwId, i.user.id);
        if (existing) {
          db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(gwId, i.user.id);
          await i.reply({ content: 'Tu ne participes plus.', ephemeral: true });
        } else {
          db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(gwId, i.user.id);
          const count = db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(gwId).c;
          await i.reply({ content: `Tu participes ! (${count} participants)`, ephemeral: true });
        }
      });

      collector.on('end', async () => {
        await endGiveaway(gwId, gwMsg, winners, prize);
      });
    }

    if (sub === 'list') {
      const gws = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY end_time DESC LIMIT 10').all(message.guild.id);
      if (gws.length === 0) return message.reply({ embeds: [E.info('Aucun giveaway.')] });

      const lines = gws.map(g => {
        const status = g.ended ? '🔴 Termine' : '🟢 Actif';
        const entries = db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(g.id).c;
        return `${status} **#${g.id}** — ${g.prize} — ${entries} participants`;
      });

      return message.reply({ embeds: [E.embed().setTitle('🎉 Giveaways').setDescription(lines.join('\n'))] });
    }

    if (sub === 'end') {
      const gwId = parseInt(args[1]);
      if (!gwId) return message.reply({ embeds: [E.error('`&giveaway end <ID>`')] });

      const gw = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(gwId, message.guild.id);
      if (!gw) return message.reply({ embeds: [E.error('Giveaway introuvable.')] });

      const channel = message.guild.channels.cache.get(gw.channel_id);
      const gwMsg = channel ? await channel.messages.fetch(gw.message_id).catch(() => null) : null;
      await endGiveaway(gwId, gwMsg, gw.winners, gw.prize);
      return message.reply({ embeds: [E.success(`Giveaway #${gwId} termine.`)] });
    }

    if (sub === 'reroll') {
      const gwId = parseInt(args[1]);
      if (!gwId) return message.reply({ embeds: [E.error('`&giveaway reroll <ID>`')] });

      const gw = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(gwId, message.guild.id);
      if (!gw) return message.reply({ embeds: [E.error('Giveaway introuvable.')] });

      const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(gwId);
      if (entries.length === 0) return message.reply({ embeds: [E.error('Aucun participant.')] });

      const shuffled = entries.sort(() => Math.random() - 0.5);
      const winnerIds = shuffled.slice(0, gw.winners).map(e => `<@${e.user_id}>`);

      return message.reply({ embeds: [E.success(`🎉 Nouveau(x) gagnant(s) : ${winnerIds.join(', ')}`)] });
    }

    if (sub === 'delete') {
      const gwId = parseInt(args[1]);
      if (!gwId) return message.reply({ embeds: [E.error('`&giveaway delete <ID>`')] });

      db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ?').run(gwId);
      db.prepare('DELETE FROM giveaways WHERE id = ? AND guild_id = ?').run(gwId, message.guild.id);
      return message.reply({ embeds: [E.success(`Giveaway #${gwId} supprime.`)] });
    }
  },
};

async function endGiveaway(gwId, gwMsg, winnerCount, prize) {
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(gwId);

  const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(gwId);

  if (entries.length === 0) {
    if (gwMsg) {
      const embed = E.embed().setTitle('🎉 GIVEAWAY TERMINE').setDescription(`**${prize}**\n\nAucun participant.`).setColor(0x2B2D31);
      await gwMsg.edit({ embeds: [embed], components: [] }).catch(() => {});
    }
    return;
  }

  const shuffled = entries.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, winnerCount).map(e => `<@${e.user_id}>`);

  if (gwMsg) {
    const embed = E.embed()
      .setTitle('🎉 GIVEAWAY TERMINE')
      .setDescription(`**${prize}**\n\n🏆 Gagnant(s) : ${winners.join(', ')}`)
      .setColor(0x57F287);
    await gwMsg.edit({ embeds: [embed], components: [] }).catch(() => {});
    await gwMsg.channel.send(`🎉 Felicitations ${winners.join(', ')} ! Vous avez gagne **${prize}** !`).catch(() => {});
  }
}
