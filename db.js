/* 家庭管理系统 - 数据存储层
   本地优先：IndexedDB 存储所有数据，离线可用。
   云同步：设置页填入 Supabase Project URL + anon/publishable key 后，
           DB.syncNow() 会对 12 张业务表做双向同步（按 uid 全局唯一合并，updated 新者胜）。
   表约定：families, members, tasks, inventory_items, trips, packing_items,
           anniversaries, milestones, dishes, meal_plans, meal_templates,
           shopping_items（点餐并入的采购清单）, settings（设备级，不同步）
*/
const DB = (function() {
  const DB_NAME = 'family-hub';
  const DB_VER = 3;
  const STORES = [
    'families','members','tasks','inventory_items',
    'trips','packing_items','anniversaries','milestones',
    'dishes','meal_plans','meal_templates','settings','shopping_items'
  ];
  // 需要云端同步的业务表（settings 为设备级偏好，不同步）
  const SYNC_TABLES = [
    'families','members','tasks','inventory_items','trips','packing_items',
    'anniversaries','milestones','dishes','meal_plans','meal_templates','shopping_items'
  ];
  let db = null;

  // 全局唯一 id
  function uid() {
    return 'h' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function open() {
    return new Promise(function(resolve, reject) {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        STORES.forEach(function(s) {
          if (s === 'settings') return;
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
        });
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  async function add(store, obj) {
    await open();
    const o = Object.assign({}, obj);
    if (!o.uid) o.uid = uid();
    o.created = o.created || Date.now();
    o.updated = Date.now();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').add(o);
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function put(store, obj) {
    await open();
    const o = Object.assign({}, obj);
    if (!o.uid) o.uid = uid();
    o.updated = Date.now();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').put(o);
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function getAll(store) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readonly').getAll();
      r.onsuccess = function() { res(r.result || []); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function get(store, id) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readonly').get(id);
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function del(store, id) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').delete(id);
      r.onsuccess = function() { res(true); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function clear(store) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').clear();
      r.onsuccess = function() { res(true); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function setSetting(key, value) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx('settings', 'readwrite').put({ key: key, value: value, updated: Date.now() });
      r.onsuccess = function() { res(true); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function getSetting(key) {
    const s = await get('settings', key);
    return s ? s.value : null;
  }

  // ========== 云同步（Supabase） ==========
  async function getSyncConf() {
    return (await getSetting('sync_conf')) || null;
  }

  async function getSyncStatus() {
    const conf = await getSyncConf();
    const last = await getSetting('sync_last');
    return {
      configured: !!(conf && conf.url && conf.key),
      last: last || null,
      url: conf ? conf.url : ''
    };
  }

  // 对 12 张业务表做双向同步：按 uid 合并，updated 新者胜
  async function syncNow() {
    const conf = await getSyncConf();
    if (!conf || !conf.url || !conf.key) {
      return { ok: false, msg: '未配置 Supabase，请在设置页填写' };
    }
    const base = String(conf.url).replace(/\/+$/, '');
    const headers = {
      'apikey': conf.key,
      'Authorization': 'Bearer ' + conf.key,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };
    let pushed = 0, pulled = 0, errors = [];
    for (const table of SYNC_TABLES) {
      try {
        const r = await syncTable(table, base, headers);
        pushed += r.pushed; pulled += r.pulled;
      } catch (e) {
        errors.push(table + ':' + (e.message || e));
      }
    }
    await setSetting('sync_last', { at: Date.now(), pushed: pushed, pulled: pulled, errors: errors });
    return { ok: errors.length === 0, pushed: pushed, pulled: pulled, errors: errors };
  }

  async function syncTable(table, base, headers) {
    // 1) 拉取云端
    const remoteRes = await fetch(base + '/rest/v1/' + table + '?select=*', { headers: headers });
    if (!remoteRes.ok) throw new Error('GET ' + remoteRes.status);
    const remoteRows = (await remoteRes.json()) || [];
    const remoteMap = {};
    remoteRows.forEach(function(r) { remoteMap[r.uid] = r; });

    // 2) 本地
    const localRows = await getAll(table);
    const localMap = {};
    localRows.forEach(function(r) { localMap[r.uid] = r; });

    let pulled = 0;
    // 3) 云端更新 -> 写回本地
    const remoteKeys = Object.keys(remoteMap);
    for (const u of remoteKeys) {
      const remote = remoteMap[u];
      const local = localMap[u];
      const rUpdated = remote.updated || 0;
      const lUpdated = (local && local.updated) || 0;
      if (!local || rUpdated > lUpdated) {
        const data = remote.data || remote;
        if (local) {
          // 保留本地 id，合并内容
          await put(table, Object.assign({}, data, { id: local.id }));
        } else {
          // 新行：去掉云端 id，让本地生成
          const d = Object.assign({}, data);
          delete d.id;
          await add(table, d);
        }
        pulled++;
      }
    }

    // 4) 本地更新 -> 推送到云端
    const toPush = [];
    Object.keys(localMap).forEach(function(u) {
      const local = localMap[u];
      const remote = remoteMap[u];
      const lUpdated = (local && local.updated) || 0;
      const rUpdated = (remote && remote.updated) || 0;
      if (!remote || lUpdated > rUpdated) {
        toPush.push({ uid: u, data: local, updated: lUpdated });
      }
    });
    let pushed = 0;
    if (toPush.length) {
      const pushRes = await fetch(base + '/rest/v1/' + table, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(toPush)
      });
      if (!pushRes.ok) throw new Error('POST ' + pushRes.status);
      pushed = toPush.length;
    }
    return { pushed: pushed, pulled: pulled };
  }

  return {
    add: add, put: put, get: get, getAll: getAll, del: del, clear: clear,
    setSetting: setSetting, getSetting: getSetting,
    syncNow: syncNow, getSyncConf: getSyncConf, getSyncStatus: getSyncStatus,
    STORES: STORES, SYNC_TABLES: SYNC_TABLES
  };
})();
