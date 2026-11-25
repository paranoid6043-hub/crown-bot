const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'crown.db.json');

let data = {
  permissions: [], sanctions: [], levels: [], welcome: [],
  giveaways: [], giveaway_entries: [], private_vocals: [], pv_access: [],
  follows: [], punished: [], busy: [], watched: [], reminders: [],
  staff_config: [], backup_channels: [], backup_perms: [],
  vocaux_perso_config: [], vocaux_perso: [], sticky_roles: [], museliere: [],
  warns: [], tempbans: [], notes: [], antiraid_config: [], antiraid_whitelist: [], logs_config: [],
  tickets_config: [], tickets: [], rolemenu: [], rolemenu_roles: [],
  invite_data: [], invite_rewards: [], modmail_config: [], modmail_threads: [],
  counters: [], custom_commands: [], locknames: [],
};

if (fs.existsSync(DB_PATH)) {
  try { data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); } catch {}
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }, 500);
}

function ensure(t) { if (!data[t]) data[t] = []; }

let _id = Date.now();

const PK = {
  bot_settings: ['bot_id'],
  permissions: ['user_id', 'guild_id'],
  levels: ['user_id', 'guild_id'],
  welcome: ['guild_id'],
  private_vocals: ['channel_id'],
  pv_access: ['channel_id', 'user_id'],
  punished: ['user_id', 'guild_id'],
  busy: ['user_id', 'guild_id'],
  watched: ['user_id', 'guild_id'],
  staff_config: ['guild_id'],
  vocaux_perso_config: ['guild_id'],
  vocaux_perso: ['channel_id'],
  sticky_roles: ['user_id', 'guild_id', 'role_id'],
  museliere: ['user_id', 'guild_id'],
  giveaway_entries: ['giveaway_id', 'user_id'],
  antiraid_config: ['guild_id'],
  antiraid_whitelist: ['guild_id', 'type', 'target_id'],
  logs_config: ['guild_id'],
  tickets_config: ['guild_id'],
  invite_data: ['user_id', 'guild_id'],
  modmail_config: ['guild_id'],
  locknames: ['user_id', 'guild_id'],
  rolemenu_roles: ['menu_id', 'role_id'],
  custom_commands: ['guild_id', 'name'],
};

const AUTO_ID = new Set(['sanctions', 'giveaways', 'follows', 'reminders', 'backup_channels', 'backup_perms', 'warns', 'tempbans', 'notes', 'tickets', 'rolemenu', 'rolemenu_roles', 'invite_rewards', 'modmail_threads', 'counters', 'custom_commands']);

class Stmt {
  constructor(sql) { this.sql = sql.trim().replace(/\s+/g, ' '); }

  _table() {
    const m = this.sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    return m ? m[1] : null;
  }

  _where() {
    const m = this.sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|\s*$)/i);
    if (!m) return [];
    return m[1].split(/\s+AND\s+/i).map(p => {
      let r = p.trim().match(/(\w+)\s*=\s*\?/);
      if (r) return { f: r[1], op: '=' };
      r = p.trim().match(/(\w+)\s*<\s*\?/);
      if (r) return { f: r[1], op: '<' };
      return null;
    }).filter(Boolean);
  }

  _order() {
    const m = this.sql.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
    return m ? { f: m[1], d: (m[2] || '').toUpperCase() === 'DESC' } : null;
  }

  _limit() {
    const m = this.sql.match(/LIMIT\s+(\?|\d+)/i);
    return m ? m[1] : null;
  }

  _match(row, conds, params, start) {
    let i = start;
    for (const c of conds) {
      const v = params[i++];
      if (c.op === '<') { if (!(row[c.f] < v)) return false; }
      else { if (row[c.f] != v) return false; }
    }
    return true;
  }

  get(...p) {
    const t = this._table(); ensure(t);
    const w = this._where();
    for (const row of data[t]) {
      if (this._match(row, w, p, 0)) return { ...row };
    }
    return undefined;
  }

  all(...p) {
    const t = this._table(); ensure(t);
    const w = this._where();
    const ord = this._order();
    const limRaw = this._limit();

    let res = data[t].filter(row => this._match(row, w, p, 0)).map(r => ({ ...r }));

    if (ord) res.sort((a, b) => {
      if (a[ord.f] < b[ord.f]) return ord.d ? 1 : -1;
      if (a[ord.f] > b[ord.f]) return ord.d ? -1 : 1;
      return 0;
    });

    const lim = limRaw === '?' ? p[w.length] : limRaw ? parseInt(limRaw) : null;
    if (lim) res = res.slice(0, lim);
    return res;
  }

  run(...p) {
    const t = this._table(); ensure(t);
    const up = this.sql.toUpperCase();

    if (up.includes('DELETE')) {
      const w = this._where();
      const before = data[t].length;
      data[t] = data[t].filter(row => !this._match(row, w, p, 0));
      save();
      return { changes: before - data[t].length };
    }

    if (up.includes('UPDATE')) {
      const setM = this.sql.match(/SET\s+(.+?)\s+WHERE/i);
      if (!setM) return { changes: 0 };
      const fields = [];
      let pi = 0;
      for (const part of setM[1].split(',')) {
        const eq = part.trim().match(/(\w+)\s*=\s*\?/);
        if (eq) fields.push({ f: eq[1], i: pi++ });
      }
      const w = this._where();
      let changes = 0;
      for (const row of data[t]) {
        if (this._match(row, w, p, pi)) {
          for (const sf of fields) row[sf.f] = p[sf.i];
          changes++;
        }
      }
      save();
      return { changes };
    }

    if (up.includes('INSERT')) {
      const m = this.sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!m) { save(); return { changes: 0, lastInsertRowid: 0 }; }
      const fields = m[1].split(',').map(f => f.trim());
      const row = {};
      fields.forEach((f, i) => { row[f] = p[i]; });

      const conflict = up.includes('ON CONFLICT');
      const ignore = up.includes('OR IGNORE');
      const replace = up.includes('OR REPLACE');
      const pk = PK[t] || ['id'];

      if (conflict || ignore || replace) {
        const idx = data[t].findIndex(r => pk.every(k => r[k] == row[k]));
        if (idx >= 0) {
          if (ignore) { save(); return { changes: 0, lastInsertRowid: data[t][idx].id || 0 }; }
          if (replace) {
            if (!row.id && data[t][idx].id) row.id = data[t][idx].id;
            data[t][idx] = row;
            save();
            return { changes: 1, lastInsertRowid: row.id || 0 };
          }
          if (conflict) {
            if (up.includes('DO NOTHING')) { save(); return { changes: 0, lastInsertRowid: data[t][idx].id || 0 }; }
            const setM = this.sql.match(/DO\s+UPDATE\s+SET\s+(.+?)$/i);
            if (setM) {
              const existing = data[t][idx];
              for (const part of setM[1].split(',')) {
                const eq = part.trim().match(/(\w+)\s*=\s*(.+)/);
                if (!eq) continue;
                const field = eq[1].trim();
                const expr = eq[2].trim();
                if (expr.match(/\w+\s*\+\s*excluded\.\w+/)) {
                  const am = expr.match(/(\w+)\s*\+\s*excluded\.(\w+)/);
                  if (am) existing[field] = (existing[am[1]] || 0) + (row[am[2]] || 0);
                } else if (expr.startsWith('excluded.')) {
                  existing[field] = row[expr.replace('excluded.', '')];
                } else if (expr.includes('+ 1')) {
                  existing[field] = (existing[field] || 0) + 1;
                }
              }
              save();
              return { changes: 1, lastInsertRowid: existing.id || 0 };
            }
          }
        }
      }

      if (AUTO_ID.has(t)) row.id = ++_id;
      if (!row.created_at && this.sql.toLowerCase().includes('created_at')) {
        row.created_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      }

      data[t].push(row);
      save();
      return { changes: 1, lastInsertRowid: row.id || 0 };
    }

    save();
    return { changes: 0 };
  }
}

const db = {
  data,
  prepare(sql) { return new Stmt(sql); },
  exec() {},
  pragma() {},
  transaction(fn) {
    return (...args) => {
      fn(...args);
      save();
    };
  },
};

module.exports = { db };
