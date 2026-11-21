const { openHelp } = require('../../utils/help-menu');
module.exports = {
  name: 'guide', description: 'Guide de départ pour configurer le serveur',
  usage: '&guide', permission: 'Public', category: 'Configuration',
  execute(message, args, client) { return openHelp(message, ['guide'], client); },
};
