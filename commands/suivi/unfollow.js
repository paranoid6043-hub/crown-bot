const E = require('../../utils/embeds');
const { removeFollow } = require('../../systems/follow');

module.exports = {
  name: 'unfollow',
  description: 'Arrete de suivre',
  usage: '&unfollow',
  permission: 'Sys',
  category: 'Suivi & Laisse',

  async execute(message) {
    removeFollow.run(message.guild.id, message.author.id, 'follow');
    return message.reply({ embeds: [E.success('Tu ne suis plus personne.')] });
  },
};
