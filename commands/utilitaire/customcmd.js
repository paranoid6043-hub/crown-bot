const { db } = require('../../database');
const { success, error, info } = require('../../utils/embeds');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'customcmd',
  aliases: ['cc', 'customcommand'],
  description: 'Commandes personnalisees',
  usage: '&customcmd add <nom> <reponse> | &customcmd remove <nom> | &customcmd list',
  permission: 'Sys+',
  category: 'Utilitaire',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'add') {
      const name = args[1]?.toLowerCase();
      if (!name) return message.reply({ embeds: [error('Precise un nom.')] });

      const response = args.slice(2).join(' ');
      if (!response) return message.reply({ embeds: [error('Precise une reponse.')] });

      db.prepare('INSERT OR REPLACE INTO custom_commands (guild_id, name, response, permission) VALUES (?, ?, ?, ?)').run(message.guild.id, name, response, 'Public');

      return message.reply({ embeds: [success(`Commande \`${config.prefix}${name}\` creee.`)] });
    }

    if (sub === 'remove' || sub === 'delete') {
      const name = args[1]?.toLowerCase();
      if (!name) return message.reply({ embeds: [error('Precise un nom.')] });

      const r = db.prepare('DELETE FROM custom_commands WHERE guild_id = ? AND name = ?').run(message.guild.id, name);
      if (!r.changes) return message.reply({ embeds: [error('Commande introuvable.')] });

      return message.reply({ embeds: [success(`Commande \`${config.prefix}${name}\` supprimee.`)] });
    }

    if (sub === 'list') {
      const cmds = db.prepare('SELECT * FROM custom_commands WHERE guild_id = ?').all(message.guild.id);
      if (cmds.length === 0) return message.reply({ embeds: [info('Aucune commande personnalisee.')] });

      const list = cmds.map(c => `\`${config.prefix}${c.name}\` → ${c.response.substring(0, 50)}${c.response.length > 50 ? '...' : ''}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setTitle('🔧 Commandes personnalisees').setDescription(list)] });
    }

    message.reply({ embeds: [info('`&customcmd add <nom> <reponse>` — Creer\n`&customcmd remove <nom>` — Supprimer\n`&customcmd list` — Lister')] });
  },
};
