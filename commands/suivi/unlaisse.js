const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { removeByTarget } = require('../../systems/follow');

module.exports = {
  name: 'unlaisse',
  description: 'Retire la laisse',
  usage: '&unlaisse <@user>',
  permission: 'Sys',
  category: 'Suivi & Laisse',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    removeByTarget.run(message.guild.id, userId, message.author.id, 'laisse');
    return message.reply({ embeds: [E.success('Laisse retiree.')] });
  },
};
