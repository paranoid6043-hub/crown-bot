const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { randomUUID } = require('crypto');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'backup',
  description: 'Systeme de backup des salons',
  usage: '&backup [save|load|list|delete] [id]',
  permission: 'Sys+',
  category: 'Salons',

  async execute(message, args) {
    const sub = (args[0] || 'save').toLowerCase();

    if (sub === 'save') {
      const backupId = randomUUID().slice(0, 8);
      const channels = message.guild.channels.cache;

      const insertChannel = db.prepare(`
        INSERT INTO backup_channels (backup_id, guild_id, channel_id, channel_name, channel_type, parent_id, parent_name, position, topic, nsfw, rate_limit, bitrate, user_limit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertPerm = db.prepare(`
        INSERT INTO backup_perms (backup_id, channel_id, target_id, target_type, allow, deny)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const saveAll = db.transaction(() => {
        for (const [, ch] of channels) {
          insertChannel.run(
            backupId, message.guild.id, ch.id, ch.name, ch.type,
            ch.parentId, ch.parent?.name || null, ch.position,
            ch.topic || null, ch.nsfw ? 1 : 0,
            ch.rateLimitPerUser || 0,
            ch.bitrate || null, ch.userLimit || null
          );

          for (const [, perm] of ch.permissionOverwrites.cache) {
            insertPerm.run(backupId, ch.id, perm.id, perm.type === 0 ? 'role' : 'member', perm.allow.bitfield.toString(), perm.deny.bitfield.toString());
          }
        }
      });

      saveAll();

      const embed = E.embed()
        .setTitle('💾 Backup sauvegardee')
        .setColor(0x57F287)
        .addFields(
          { name: 'ID', value: `\`${backupId}\``, inline: true },
          { name: 'Salons', value: `${channels.size}`, inline: true },
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const backups = db.prepare(`
        SELECT backup_id, COUNT(*) as count, MIN(created_at) as created
        FROM backup_channels WHERE guild_id = ?
        GROUP BY backup_id ORDER BY created DESC LIMIT 10
      `).all(message.guild.id);

      if (backups.length === 0) return message.reply({ embeds: [E.info('Aucune backup.')] });

      const lines = backups.map(b => `\`${b.backup_id}\` — **${b.count}** salons — ${b.created}`);
      return message.reply({ embeds: [E.embed().setTitle('💾 Backups').setDescription(lines.join('\n'))] });
    }

    if (sub === 'load') {
      const backupId = args[1];
      if (!backupId) return message.reply({ embeds: [E.error('`&backup load <id>`')] });

      const channels = db.prepare('SELECT * FROM backup_channels WHERE backup_id = ? AND guild_id = ? ORDER BY position')
        .all(backupId, message.guild.id);
      if (channels.length === 0) return message.reply({ embeds: [E.error('Backup introuvable.')] });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('backup_confirm').setLabel('Confirmer la restauration').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('backup_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
      );

      const embed = E.warn(`Tu vas restaurer la backup \`${backupId}\` (**${channels.length}** salons).\n⚠️ Tous les salons actuels seront supprimes.`);
      const msg = await message.reply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 30_000, filter: i => i.user.id === message.author.id });

      collector.on('collect', async (i) => {
        if (i.customId === 'backup_cancel') {
          return i.update({ embeds: [E.info('Restauration annulee.')], components: [] });
        }

        await i.update({ embeds: [E.info('🔄 Restauration en cours...')], components: [] });

        for (const [, ch] of message.guild.channels.cache) {
          await ch.delete().catch(() => {});
        }

        const categoryMap = new Map();
        const categories = channels.filter(c => c.channel_type === ChannelType.GuildCategory);
        for (const cat of categories) {
          const perms = db.prepare('SELECT * FROM backup_perms WHERE backup_id = ? AND channel_id = ?').all(backupId, cat.channel_id);
          const permOverwrites = perms.map(p => ({
            id: p.target_id,
            type: p.target_type === 'role' ? 0 : 1,
            allow: BigInt(p.allow),
            deny: BigInt(p.deny),
          }));

          const newCat = await message.guild.channels.create({
            name: cat.channel_name,
            type: ChannelType.GuildCategory,
            position: cat.position,
            permissionOverwrites: permOverwrites,
          }).catch(() => null);

          if (newCat) categoryMap.set(cat.channel_id, newCat.id);
        }

        const others = channels.filter(c => c.channel_type !== ChannelType.GuildCategory);
        for (const ch of others) {
          const perms = db.prepare('SELECT * FROM backup_perms WHERE backup_id = ? AND channel_id = ?').all(backupId, ch.channel_id);
          const permOverwrites = perms.map(p => ({
            id: p.target_id,
            type: p.target_type === 'role' ? 0 : 1,
            allow: BigInt(p.allow),
            deny: BigInt(p.deny),
          }));

          const opts = {
            name: ch.channel_name,
            type: ch.channel_type,
            position: ch.position,
            topic: ch.topic,
            nsfw: !!ch.nsfw,
            rateLimitPerUser: ch.rate_limit,
            permissionOverwrites: permOverwrites,
          };

          if (ch.parent_id) {
            opts.parent = categoryMap.get(ch.parent_id) || null;
          }
          if (ch.bitrate) opts.bitrate = ch.bitrate;
          if (ch.user_limit) opts.userLimit = ch.user_limit;

          await message.guild.channels.create(opts).catch(() => {});
        }

        const fallback = message.guild.channels.cache.filter(c => c.isTextBased()).first();
        if (fallback) {
          fallback.send({ embeds: [E.success(`Backup \`${backupId}\` restauree avec succes.`)] }).catch(() => {});
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
      });
    }

    if (sub === 'delete') {
      const backupId = args[1];
      if (!backupId) return message.reply({ embeds: [E.error('`&backup delete <id>`')] });

      db.prepare('DELETE FROM backup_channels WHERE backup_id = ? AND guild_id = ?').run(backupId, message.guild.id);
      db.prepare('DELETE FROM backup_perms WHERE backup_id = ?').run(backupId);
      return message.reply({ embeds: [E.success(`Backup \`${backupId}\` supprimee.`)] });
    }
  },
};
