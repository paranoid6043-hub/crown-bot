const E = require('../../utils/embeds');
const { clearAll } = require('../../systems/follow');

module.exports = {
  name: 'fldelete',
  description: 'Supprime tous les follow/laisse',
  usage: '&fldelete',
  permission: 'Sys+',
  category: 'Suivi & Laisse',

  async execute(message) {
    clearAll.run(message.guild.id);
    return message.reply({ embeds: [E.success('Tous les follow et laisses ont ete supprimes.')] });
  },
};
