const ticket = require('./ticket');

module.exports = {
  name: 'close', description: 'Fermer et supprimer immédiatement le ticket',
  usage: '&close', permission: 'Public', category: 'Tickets',
  async execute(message, args) {
    return ticket.execute(message, ['close', ...args]);
  },
};
