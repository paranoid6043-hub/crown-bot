const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'invitereward',
  aliases: ['invreward'],
  description: 'Gerer les recompenses d\'invitations',
  usage: '&invitereward add <nombre> <@role> | &invitereward list | &invitereward remove <nombre>',
  permission: 'Sys+',
  category: 'Invitations',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'add') {
      const required = parseInt(args[1]);
      if (!required || required < 1) return message.reply({ embeds: [error('Nombre d\'invitations invalide.')] });

      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
      if (!role) return message.reply({ embeds: [error('Mentionne un role.')] });

      db.prepare('INSERT INTO invite_rewards (guild_id, required_invites, role_id) VALUES (?, ?, ?)').run(message.guild.id, required, role.id);

      return message.reply({ embeds: [success(`Recompense ajoutee : ${role} a ${required} invitations.`)] });
    }

    if (sub === 'list') {
      const rewards = db.prepare('SELECT * FROM invite_rewards WHERE guild_id = ? ORDER BY required_invites ASC').all(message.guild.id);
      if (rewards.length === 0) return message.reply({ embeds: [info('Aucune recompense configuree.')] });

      const list = rewards.map(r => `**${r.required_invites}** invites → <@&${r.role_id}>`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.accentColor).setTitle('🎁 Recompenses invitations').setDescription(list)] });
    }

    if (sub === 'remove') {
      const required = parseInt(args[1]);
      db.prepare('DELETE FROM invite_rewards WHERE guild_id = ? AND required_invites = ?').run(message.guild.id, required);
      return message.reply({ embeds: [success(`Recompense pour ${required} invites supprimee.`)] });
    }

    message.reply({ embeds: [info('`&invitereward add <nombre> @role` — Ajouter\n`&invitereward list` — Lister\n`&invitereward remove <nombre>` — Supprimer')] });
  },
};
