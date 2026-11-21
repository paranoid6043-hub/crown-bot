require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  prefix: '&',

  embedColor: 0x2B2D31,
  accentColor: 0x5865F2,
  successColor: 0x57F287,
  errorColor: 0xED4245,
  warnColor: 0xFEE75C,

  xp: {
    minPerMessage: 15,
    maxPerMessage: 25,
    cooldownMs: 60_000,
  },

  hierarchy: ['Public', 'WL', 'Owner', 'Sys', 'Sys+'],
};
