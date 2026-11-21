const { executeProfile } = require('../../utils/bot-profile');
module.exports = {
  name: 'setname', aliases: ['setnick', 'setnickname'], description: 'Modifier le nom affiché du bot sur ce serveur',
  usage: '&setname <nouveau nom>', permission: 'Public', category: 'Configuration',
  execute(message, args, client) { return executeProfile(message, args, client, 'nickname'); },
};
