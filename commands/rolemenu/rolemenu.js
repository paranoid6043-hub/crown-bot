const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  name: 'rolemenu',
  aliases: ['rm'],
  description: 'Cree un menu de roles',
  usage: '&rolemenu create <titre> | &rolemenu add <id> <@role> <emoji> [label] | &rolemenu send <id> [#salon] | &rolemenu delete <id> | &rolemenu list',
  permission: 'Sys+',
  category: 'Role Menu',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'create') {
      const title = args.slice(1).join(' ') || 'Role Menu';
      const r = db.prepare('INSERT INTO rolemenu (guild_id, channel_id, message_id, title) VALUES (?, ?, ?, ?)').run(message.guild.id, '', '', title);
      return message.reply({ embeds: [success(`Role menu **${title}** cree avec l'ID **${r.lastInsertRowid}**.\nAjoute des roles avec \`&rolemenu add ${r.lastInsertRowid} @role emoji [label]\``)] });
    }

    if (sub === 'add') {
      const menuId = parseInt(args[1]);
      const menu = db.prepare('SELECT * FROM rolemenu WHERE id = ? AND guild_id = ?').get(menuId, message.guild.id);
      if (!menu) return message.reply({ embeds: [error('Menu introuvable.')] });

      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
      if (!role) return message.reply({ embeds: [error('Mentionne un role.')] });

      const emoji = args[3] || '⭐';
      const label = args.slice(4).join(' ') || role.name;

      db.prepare('INSERT OR REPLACE INTO rolemenu_roles (menu_id, role_id, emoji, label) VALUES (?, ?, ?, ?)').run(menuId, role.id, emoji, label);

      return message.reply({ embeds: [success(`Role ${role} ajoute au menu ${menuId} avec ${emoji}.`)] });
    }

    if (sub === 'send') {
      const menuId = parseInt(args[1]);
      const menu = db.prepare('SELECT * FROM rolemenu WHERE id = ? AND guild_id = ?').get(menuId, message.guild.id);
      if (!menu) return message.reply({ embeds: [error('Menu introuvable.')] });

      const roles = db.prepare('SELECT * FROM rolemenu_roles WHERE menu_id = ?').all(menuId);
      if (roles.length === 0) return message.reply({ embeds: [error('Aucun role dans ce menu.')] });

      const channelId = args[2]?.replace(/[<#>]/g, '');
      const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

      const embed = new EmbedBuilder()
        .setColor(config.accentColor)
        .setTitle(`🏷️ ${menu.title}`)
        .setDescription(roles.map(r => `${r.emoji} — <@&${r.role_id}>`).join('\n'));

      const components = [];
      if (roles.length <= 5) {
        const row = new ActionRowBuilder();
        for (const r of roles) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`rm_${menuId}_${r.role_id}`)
              .setLabel(r.label)
              .setEmoji(r.emoji)
              .setStyle(ButtonStyle.Secondary),
          );
        }
        components.push(row);
      } else {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`rms_${menuId}`)
          .setPlaceholder('Choisis un role...')
          .setMinValues(0)
          .setMaxValues(roles.length)
          .addOptions(roles.map(r => ({ label: r.label, value: r.role_id, emoji: r.emoji })));
        components.push(new ActionRowBuilder().addComponents(select));
      }

      const msg = await channel.send({ embeds: [embed], components });
      db.prepare('UPDATE rolemenu SET channel_id = ?, message_id = ? WHERE id = ?').run(channel.id, msg.id, menuId);

      return message.reply({ embeds: [success(`Role menu envoye dans ${channel}.`)] });
    }

    if (sub === 'delete') {
      const menuId = parseInt(args[1]);
      db.prepare('DELETE FROM rolemenu WHERE id = ? AND guild_id = ?').run(menuId, message.guild.id);
      db.prepare('DELETE FROM rolemenu_roles WHERE menu_id = ?').run(menuId);
      return message.reply({ embeds: [success(`Menu ${menuId} supprime.`)] });
    }

    if (sub === 'list') {
      const menus = db.prepare('SELECT * FROM rolemenu WHERE guild_id = ?').all(message.guild.id);
      if (menus.length === 0) return message.reply({ embeds: [info('Aucun role menu.')] });

      const list = menus.map(m => {
        const roles = db.prepare('SELECT * FROM rolemenu_roles WHERE menu_id = ?').all(m.id);
        return `**#${m.id}** — ${m.title} (${roles.length} roles)`;
      }).join('\n');

      return message.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setTitle('🏷️ Role Menus').setDescription(list)] });
    }

    message.reply({ embeds: [info('`&rolemenu create <titre>` — Creer\n`&rolemenu add <id> @role emoji [label]` — Ajouter un role\n`&rolemenu send <id> [#salon]` — Envoyer\n`&rolemenu list` — Lister\n`&rolemenu delete <id>` — Supprimer')] });
  },
};
