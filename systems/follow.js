const { db } = require('../database');

const getFollows = db.prepare('SELECT * FROM follows WHERE guild_id = ? AND target_id = ? AND type = ?');
const getLeashes = db.prepare('SELECT * FROM follows WHERE guild_id = ? AND follower_id = ? AND type = ?');
const getAllActive = db.prepare('SELECT * FROM follows WHERE guild_id = ?');
const addFollow = db.prepare('INSERT INTO follows (guild_id, follower_id, target_id, type, expires_at) VALUES (?, ?, ?, ?, ?)');
const removeFollow = db.prepare('DELETE FROM follows WHERE guild_id = ? AND follower_id = ? AND type = ?');
const removeByTarget = db.prepare('DELETE FROM follows WHERE guild_id = ? AND target_id = ? AND follower_id = ? AND type = ?');
const clearAll = db.prepare('DELETE FROM follows WHERE guild_id = ?');
const cleanExpired = db.prepare('DELETE FROM follows WHERE expires_at < ?');

function handleFollow(oldState, newState, client) {
  if (!newState.guild) return;
  if (oldState.channelId === newState.channelId) return;

  cleanExpired.run(Date.now());

  if (newState.channelId && newState.member) {
    const follows = getFollows.all(newState.guild.id, newState.member.id, 'follow');
    for (const f of follows) {
      const follower = newState.guild.members.cache.get(f.follower_id);
      if (follower && follower.voice.channelId) {
        follower.voice.setChannel(newState.channelId).catch(() => {});
      }
    }
  }

  if (newState.channelId && newState.member) {
    const leashes = getLeashes.all(newState.guild.id, newState.member.id, 'laisse');
    for (const l of leashes) {
      const target = newState.guild.members.cache.get(l.target_id);
      if (target && target.voice.channelId) {
        target.voice.setChannel(newState.channelId).catch(() => {});
      }
    }
  }
}

module.exports = { handleFollow, addFollow, removeFollow, removeByTarget, clearAll, getAllActive, getFollows, getLeashes };
