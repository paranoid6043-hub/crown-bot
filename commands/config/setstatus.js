const { executeProfile } = require('../../utils/bot-profile');
module.exports = {
  name: 'setstatus', aliases: ['setactivity'], description: 'Modifier le texte d’activité du bot',
  usage: '&setstatus <texte | off>', permission: 'Public', category: 'Configuration',
  execute(message, args, client) { return executeProfile(message, args, client, 'status'); },
};
