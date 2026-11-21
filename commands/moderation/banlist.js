const E = require('../../utils/embeds');

module.exports = {
  name: 'banlist',
  description: 'Liste des bannis avec leur raison',
  usage: '&banlist [page]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const bans = await message.guild.bans.fetch();
    if (bans.size === 0) return message.reply({ embeds: [E.info('Aucun membre banni.')] });

    const page = Math.max(1, parseInt(args[0]) || 1);
    const perPage = 10;
    const pages = Math.ceil(bans.size / perPage);
    const start = (page - 1) * perPage;

    const banArray = [...bans.values()].slice(start, start + perPage);

    const lines = banArray.map(b =>
      `**${b.user.tag}** (${b.user.id})\n└ ${b.reason || 'Aucune raison'}`
    );

    const embed = E.embed()
      .setTitle(`🔨 Liste des bannis`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Page ${page}/${pages} — ${bans.size} banni(s) au total` });

    return message.reply({ embeds: [embed] });
  },
};
