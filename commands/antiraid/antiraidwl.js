const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'antiraidwl',
  aliases: ['arwl'],
  description: 'Whitelist anti-raid (salons et rôles exemptés)',
  usage: '&antiraidwl <add|remove|list> <#salon|@role>',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();

    if (!action || !['add', 'remove', 'list', 'clear'].includes(action)) {
      return message.reply({ embeds: [info('`&antiraidwl add <#salon|@role>` — ajouter à la whitelist\n`&antiraidwl remove <#salon|@role>` — retirer\n`&antiraidwl list` — voir la whitelist\n`&antiraidwl clear` — tout supprimer')] });
    }

    if (action === 'list') {
      const channels = db.prepare('SELECT * FROM antiraid_whitelist WHERE guild_id = ? AND type = ?').all(message.guild.id, 'channel');
      const roles = db.prepare('SELECT * FROM antiraid_whitelist WHERE guild_id = ? AND type = ?').all(message.guild.id, 'role');

      if (!channels.length && !roles.length) {
        return message.reply({ embeds: [info('Aucune whitelist configurée.')] });
      }

      const e = new EmbedBuilder()
        .setColor(config.accentColor)
        .setTitle('📋 Whitelist Anti-Raid');

      if (channels.length) e.addFields({ name: 'Salons', value: channels.map(w => `<#${w.target_id}>`).join('\n') });
      if (roles.length) e.addFields({ name: 'Rôles', value: roles.map(w => `<@&${w.target_id}>`).join('\n') });

      return message.reply({ embeds: [e] });
    }

    if (action === 'clear') {
      db.prepare('DELETE FROM antiraid_whitelist WHERE guild_id = ?').run(message.guild.id);
      return message.reply({ embeds: [success('Whitelist anti-raid vidée.')] });
    }

    const target = args[1];
    if (!target) return message.reply({ embeds: [error('Mentionne un salon ou un rôle.')] });

    const channelMatch = target.match(/^<#(\d+)>$/);
    const roleMatch = target.match(/^<@&(\d+)>$/);

    if (channelMatch) {
      const channelId = channelMatch[1];
      if (action === 'add') {
        db.prepare('INSERT INTO antiraid_whitelist (guild_id, type, target_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(message.guild.id, 'channel', channelId);
        return message.reply({ embeds: [success(`<#${channelId}> ajouté à la whitelist anti-raid.`)] });
      } else {
        db.prepare('DELETE FROM antiraid_whitelist WHERE guild_id = ? AND type = ? AND target_id = ?').run(message.guild.id, 'channel', channelId);
        return message.reply({ embeds: [success(`<#${channelId}> retiré de la whitelist anti-raid.`)] });
      }
    }

    if (roleMatch) {
      const roleId = roleMatch[1];
      if (action === 'add') {
        db.prepare('INSERT INTO antiraid_whitelist (guild_id, type, target_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(message.guild.id, 'role', roleId);
        return message.reply({ embeds: [success(`<@&${roleId}> ajouté à la whitelist anti-raid.`)] });
      } else {
        db.prepare('DELETE FROM antiraid_whitelist WHERE guild_id = ? AND type = ? AND target_id = ?').run(message.guild.id, 'role', roleId);
        return message.reply({ embeds: [success(`<@&${roleId}> retiré de la whitelist anti-raid.`)] });
      }
    }

    return message.reply({ embeds: [error('Format invalide. Mentionne un `#salon` ou un `@rôle`.')] });
  },
};
