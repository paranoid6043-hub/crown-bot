const { db } = require('../database');
const config = require('../config');

const cooldowns = new Map();

const getUser = db.prepare('SELECT * FROM levels WHERE user_id = ? AND guild_id = ?');
const upsertXp = db.prepare(`
  INSERT INTO levels (user_id, guild_id, xp, level, messages)
  VALUES (?, ?, ?, 0, 1)
  ON CONFLICT(user_id, guild_id) DO UPDATE SET xp = xp + excluded.xp, messages = messages + 1
`);
const setLevelStmt = db.prepare('UPDATE levels SET level = ? WHERE user_id = ? AND guild_id = ?');
const getLeaderboard = db.prepare('SELECT * FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?');
const resetUser = db.prepare('DELETE FROM levels WHERE user_id = ? AND guild_id = ?');

function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

function handleXp(message) {
  const key = `${message.author.id}-${message.guild.id}`;
  const now = Date.now();
  if (cooldowns.has(key) && now - cooldowns.get(key) < config.xp.cooldownMs) return;
  cooldowns.set(key, now);

  const xpGain = Math.floor(Math.random() * (config.xp.maxPerMessage - config.xp.minPerMessage + 1)) + config.xp.minPerMessage;
  upsertXp.run(message.author.id, message.guild.id, xpGain);

  const user = getUser.get(message.author.id, message.guild.id);
  if (!user) return;

  const needed = xpForLevel(user.level);
  if (user.xp >= needed) {
    const newLevel = user.level + 1;
    setLevelStmt.run(newLevel, message.author.id, message.guild.id);
    message.channel.send({
      embeds: [{
        color: config.accentColor,
        description: `🎉 **GG ${message.author}** ! Tu es maintenant niveau **${newLevel}** !`,
      }],
    }).catch(() => {});
  }
}

module.exports = { handleXp, xpForLevel, getUser, getLeaderboard, resetUser };
