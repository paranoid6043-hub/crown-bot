const { Collection } = require('discord.js');
const { db } = require('../database');

const inviteCache = new Collection();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Collection(invites.map(i => [i.code, i.uses])));
  } catch {}
}

async function trackInvite(member) {
  const { guild } = member;
  const oldInvites = inviteCache.get(guild.id) || new Collection();

  try {
    const newInvites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Collection(newInvites.map(i => [i.code, i.uses])));

    const used = newInvites.find(i => (oldInvites.get(i.code) || 0) < i.uses);
    if (used && used.inviter) {
      db.prepare('INSERT INTO invite_data (user_id, guild_id, invites_count, invites_left, invites_fake) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, guild_id) DO UPDATE SET invites_count = invites_count + 1, invites_left = invites_left + 1').run(used.inviter.id, guild.id, 1, 1, 0);

      const data = db.prepare('SELECT * FROM invite_data WHERE user_id = ? AND guild_id = ?').get(used.inviter.id, guild.id);
      if (data) {
        const rewards = db.prepare('SELECT * FROM invite_rewards WHERE guild_id = ? AND required_invites <= ? ORDER BY required_invites DESC').all(guild.id, data.invites_count);
        for (const r of rewards) {
          const m = guild.members.cache.get(used.inviter.id);
          if (m && !m.roles.cache.has(r.role_id)) {
            m.roles.add(r.role_id).catch(() => {});
          }
        }
      }

      return used.inviter;
    }
  } catch {}
  return null;
}

async function handleMemberLeave(member) {
  db.prepare('UPDATE invite_data SET invites_left = CASE WHEN invites_left > 0 THEN invites_left - 1 ELSE 0 END WHERE guild_id = ?').run(member.guild.id);
}

module.exports = { cacheInvites, trackInvite, handleMemberLeave };
