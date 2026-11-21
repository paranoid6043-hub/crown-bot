const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'sticky',
  description: 'Role impose en permanence a un membre',
  usage: '&sticky add|remove|list <@user> <@role>',
  permission: 'Sys+',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'list') {
      const stickies = db.prepare('SELECT * FROM sticky_roles WHERE guild_id = ?').all(message.guild.id);
      if (stickies.length === 0) return message.reply({ embeds: [E.info('Aucun sticky role.')] });

      const lines = stickies.map(s => `<@${s.user_id}> — <@&${s.role_id}>`);
      return message.reply({ embeds: [E.embed().setTitle('📌 Sticky Roles').setDescription(lines.join('\n'))] });
    }

    if (sub === 'add' || sub === 'remove') {
      const userId = parseUser(args[1], message);
      const roleMention = args[2]?.match(/<@&(\d+)>/);
      const roleId = roleMention?.[1] || args[2];

      if (!userId || !roleId) return message.reply({ embeds: [E.error(`\`&sticky ${sub} <@user> <@role>\``)] });

      const role = message.guild.roles.cache.get(roleId);
      if (!role) return message.reply({ embeds: [E.error('Role introuvable.')] });

      if (sub === 'add') {
        db.prepare('INSERT OR IGNORE INTO sticky_roles (user_id, guild_id, role_id) VALUES (?, ?, ?)').run(userId, message.guild.id, roleId);
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member) await member.roles.add(role).catch(() => {});
        return message.reply({ embeds: [E.success(`Sticky role ${role} ajoute a <@${userId}>.`)] });
      }

      db.prepare('DELETE FROM sticky_roles WHERE user_id = ? AND guild_id = ? AND role_id = ?').run(userId, message.guild.id, roleId);
      return message.reply({ embeds: [E.success(`Sticky role ${role} retire de <@${userId}>.`)] });
    }

    return message.reply({ embeds: [E.error('`&sticky add|remove|list`')] });
  },
};
