const { EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const { parseUser } = require('../../utils/parsers');
const config = require('../../config');

module.exports = {
  name: 'invites',
  aliases: ['inv'],
  description: 'Voir les invitations d\'un membre',
  usage: '&invites [@user]',
  permission: 'Public',
  category: 'Invitations',

  async execute(message, args) {
    const userId = parseUser(args[0]) || message.author.id;
    const data = db.prepare('SELECT * FROM invite_data WHERE user_id = ? AND guild_id = ?').get(userId, message.guild.id);

    const total = data?.invites_count || 0;
    const left = data?.invites_left || 0;
    const fake = data?.invites_fake || 0;
    const valid = left - fake;

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('📩 Invitations')
      .setDescription(`<@${userId}> a **${valid}** invitations valides.\n\n📊 Total: **${total}** | Restantes: **${left}** | Fakes: **${fake}**`);

    message.reply({ embeds: [e] });
  },
};
