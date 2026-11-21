const { db } = require('../database');
const config = require('../config');

const getLevel = db.prepare('SELECT level FROM permissions WHERE user_id = ? AND guild_id = ?');
const setLevel = db.prepare(`
  INSERT INTO permissions (user_id, guild_id, level) VALUES (?, ?, ?)
  ON CONFLICT(user_id, guild_id) DO UPDATE SET level = excluded.level
`);
const deleteLevel = db.prepare('DELETE FROM permissions WHERE user_id = ? AND guild_id = ?');
const listByLevel = db.prepare('SELECT user_id FROM permissions WHERE guild_id = ? AND level = ?');

function getUserLevel(userId, guild) {
  if (userId === guild.ownerId) return 'Sys+';
  const row = getLevel.get(userId, guild.id);
  return row ? row.level : 'Public';
}

function hierarchyIndex(level) {
  return config.hierarchy.indexOf(level);
}

function hasPermission(userId, guild, requiredLevel) {
  const userLevel = getUserLevel(userId, guild);
  return hierarchyIndex(userLevel) >= hierarchyIndex(requiredLevel);
}

function setUserLevel(userId, guildId, level) {
  if (level === 'Public') {
    deleteLevel.run(userId, guildId);
  } else {
    setLevel.run(userId, guildId, level);
  }
}

function getLevelEmoji(level) {
  const emojis = { 'Sys+': '👑', 'Sys': '⚙️', 'Owner': '🔑', 'WL': '✅', 'Public': '👤' };
  return emojis[level] || '👤';
}

module.exports = { getUserLevel, hasPermission, setUserLevel, hierarchyIndex, getLevelEmoji, listByLevel };
