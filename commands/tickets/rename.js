const ticket = require('./ticket');

module.exports = {
  name: 'rename', description: 'Renommer le salon du ticket',
  usage: '&rename <nouveau nom>', permission: 'Public', category: 'Tickets',
  async execute(message, args) {
    return ticket.execute(message, ['rename', ...args]);
  },
};
