const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function success(desc) {
  return new EmbedBuilder().setColor(config.successColor).setDescription(`✅ ${desc}`);
}

function error(desc) {
  return new EmbedBuilder().setColor(config.errorColor).setDescription(`❌ ${desc}`);
}

function info(desc) {
  return new EmbedBuilder().setColor(config.accentColor).setDescription(desc);
}

function warn(desc) {
  return new EmbedBuilder().setColor(config.warnColor).setDescription(`⚠️ ${desc}`);
}

function noPerms() {
  return error('Tu n\'as pas la permission d\'utiliser cette commande.');
}

function embed() {
  return new EmbedBuilder().setColor(config.embedColor);
}

module.exports = { success, error, info, warn, noPerms, embed };
