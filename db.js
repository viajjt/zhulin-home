/* 家庭管理系统 - 数据存储层
   本地优先：IndexedDB 存储所有数据，离线可用。
   云同步：设置页填入 Supabase Project URL + anon/publishable key 后，
           DB.syncNow() 会对 14 张业务表做双向同步（按 uid 全局唯一合并，updated 新者胜）。
           DB.startAutoSync() 启动「打开即同步 + 每 30 秒轮询 + 切回页面立即同步」。
   表约定：families, members, tasks, inventory_items, trips, packing_items,
           anniversaries, milestones, dishes, meal_plans, meal_templates,
           shopping_items（点餐并入的采购清单）, budgets（年度预算）,
           transactions（收支流水）, settings（设备级，不同步）
*/
const DB = (function() {
  const DB_NAME = 'family-hub';
  const DB_VER = 5;
  const STORES = [
    'families','members','tasks','inventory_items',
    'trips','packing_items','anniversaries','milestones',
    'dishes','meal_plans','meal_templates','settings','shopping_items',
    'budgets','transactions','messages'
  ];
  // 需要云端同步的业务表（settings 为设备级偏好，不同步）
  const SYNC_TABLES = [
    'families','members','tasks','inventory_items','trips','packing_items',
    'anniversaries','milestones','dishes','meal_plans','meal_templates','shopping_items',
    'budgets','transactions','messages'
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

  // 同步专用：写入时保留原始 updated，不刷新（避免同步乒乓循环）
  async function putRaw(store, obj) {
    await open();
    const o = Object.assign({}, obj);
    if (!o.uid) o.uid = uid();
    if (!o.updated) o.updated = Date.now();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').put(o);
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
  }

  // 同步专用：新增时保留原始 uid 和 updated，不生成新 uid、不刷新时间
  async function addRaw(store, obj) {
    await open();
    const o = Object.assign({}, obj);
    if (!o.uid) throw new Error('addRaw requires uid');
    if (!o.updated) o.updated = Date.now();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').add(o);
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
  }

  // 不过滤的原始获取（同步内部使用）
  async function getAllRaw(store) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readonly').getAll();
      r.onsuccess = function() { res(r.result || []); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function getAll(store) {
    const all = await getAllRaw(store);
    // 过滤掉已软删除的记录
    return all.filter(function(r) { return !r.deleted; });
  }

  async function get(store, id) {
    await open();
    return new Promise(function(res, rej) {
      const r = tx(store, 'readonly').get(id);
      r.onsuccess = function() {
        const result = r.result;
        // 已软删除的记录返回 null
        if (result && result.deleted) res(null);
        else res(result);
      };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function del(store, id) {
    // 软删除：标记 deleted=true，同步到云端后其他端也会删除
    // 避免"删除后重新出现"的问题
    await open();
    return new Promise(function(res, rej) {
      const txn = tx(store, 'readwrite');
      const getReq = txn.get(id);
      getReq.onsuccess = function() {
        const existing = getReq.result;
        if (existing) {
          existing.deleted = true;
          existing.updated = Date.now();
          const putReq = txn.put(existing);
          putReq.onsuccess = function() { res(true); };
          putReq.onerror = function() { rej(putReq.error); };
        } else {
          res(true);
        }
      };
      getReq.onerror = function() { rej(getReq.error); };
    });
  }

  // 真正从数据库删除（用于清理已软删除超过7天的记录）
  async function purgeDeleted(store) {
    await open();
    const rows = await getAllRaw(store);
    const cutoff = Date.now() - 7 * 86400000; // 7天前
    for (const r of rows) {
      if (r.deleted && r.updated && r.updated < cutoff) {
        await new Promise(function(res, rej) {
          const req = tx(store, 'readwrite').delete(r.id);
          req.onsuccess = function() { res(); };
          req.onerror = function() { rej(req.error); };
        });
      }
    }
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

    // 2) 本地（使用 getAllRaw，包含已删除标记，确保删除能同步）
    const localRows = await getAllRaw(table);
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
      const rDeleted = !!(remote.data ? remote.data.deleted : remote.deleted);
      const lDeleted = !!(local && local.deleted);
      // 保护：本地已删除且比云端新时，不被云端未删除的记录覆盖
      if (local && lDeleted && !rDeleted && lUpdated >= rUpdated) continue;
      if (!local || rUpdated > lUpdated) {
        const data = remote.data || remote;
        if (local) {
          // 保留本地 id，合并内容，保留云端 updated（不刷新，避免乒乓循环）
          await putRaw(table, Object.assign({}, data, { id: local.id, updated: rUpdated }));
        } else {
          // 新行：去掉云端 id，保留 uid 和 updated，让本地生成 id
          const d = Object.assign({}, data);
          delete d.id;
          d.updated = rUpdated;
          await addRaw(table, d);
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

  // ===== 自动同步：打开即同步 + 每 30 秒轮询 + 切回页面立即同步 =====
  let autoTimer = null;
  const AUTO_INTERVAL = 30000; // 30 秒

  // 启动时补全缺失 uid（旧数据可能没有 uid，会导致同步重复）
  async function ensureUids() {
    await open();
    for (const table of SYNC_TABLES) {
      try {
        const rows = await getAll(table);
        for (const r of rows) {
          if (!r.uid) {
            r.uid = uid();
            r.updated = r.updated || Date.now();
            await putRaw(table, r);
          }
        }
      } catch(e) {}
    }
  }

  // 各表业务去重关键字段（同字段值视为重复）
  const DEDUPE_KEYS = {
    families: ['name'],
    members: ['name'],
    tasks: ['title', 'date', 'time'],
    inventory_items: ['name'],
    trips: ['dest', 'start'],
    packing_items: ['tripId', 'name'],
    anniversaries: ['name', 'date'],
    milestones: ['tripId', 'title'],
    dishes: ['name'],
    meal_plans: ['date', 'dishes', 'cook', 'meal_type'],
    meal_templates: ['name'],
    shopping_items: ['name'],
    budgets: ['year'],
    transactions: ['date', 'amount', 'category', 'note'],
    messages: ['text', 'sender']
  };

  // 清理重复数据：先按 uid 去重，再按业务关键字段去重
  async function dedupe() {
    await open();
    let total = 0;
    for (const table of SYNC_TABLES) {
      try {
        const rows = await getAll(table);
        // 1) 按 uid 去重
        const seenUid = {};
        let toDelete = [];
        rows.forEach(function(r) {
          const u = r.uid || ('_noid_' + r.id);
          if (!seenUid[u]) { seenUid[u] = r; }
          else {
            if ((r.updated || 0) > (seenUid[u].updated || 0)) { toDelete.push(seenUid[u].id); seenUid[u] = r; }
            else { toDelete.push(r.id); }
          }
        });
        // 2) 按业务关键字段去重（针对 uid 不同但内容重复的记录）
        const keys = DEDUPE_KEYS[table];
        if (keys) {
          const remaining = rows.filter(function(r) { return toDelete.indexOf(r.id) < 0; });
          const seenBiz = {};
          remaining.forEach(function(r) {
            const bizKey = keys.map(function(k) { return r[k] || ''; }).join('|');
            if (!bizKey.replace(/\|/g,'')) return; // 空字段不参与
            if (!seenBiz[bizKey]) { seenBiz[bizKey] = r; }
            else {
              if ((r.updated || 0) > (seenBiz[bizKey].updated || 0)) {
                toDelete.push(seenBiz[bizKey].id); seenBiz[bizKey] = r;
              } else {
                toDelete.push(r.id);
              }
            }
          });
        }
        for (const id of toDelete) { await del(table, id); total++; }
      } catch(e) {}
    }
    return total;
  }

  async function startAutoSync() {
    const conf = await getSyncConf();
    if (!conf || !conf.url || !conf.key) return;
    // 先补全 uid，再同步
    await ensureUids().catch(function() {});
    // 打开立即同步一次
    syncNow().catch(function() {});
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(function() {
      // 页面隐藏时暂停，节省流量；可见时才轮询
      if (document.visibilityState === 'visible') {
        syncNow().catch(function() {});
      }
    }, AUTO_INTERVAL);
  }

  function stopAutoSync() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  // 切回页面时立即同步一次（家人在别的设备刚改完，切回来马上看到）
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        getSyncConf().then(function(conf) {
          if (conf && conf.url && conf.key) syncNow().catch(function() {});
        }).catch(function() {});
      }
    });
  }

  // ===== 家庭名称（存 families 表，云端同步，全家一致） =====
  async function getFamilyName() {
    await open();
    const list = await getAll('families');
    if (list.length) return list[0].name || '朱林之家';
    await add('families', { name: '朱林之家' });
    return '朱林之家';
  }
  async function setFamilyName(name) {
    await open();
    const list = await getAll('families');
    if (list.length) {
      const f = list[0];
      f.name = name;
      await put('families', f);
    } else {
      await add('families', { name: name });
    }
    return name;
  }

  return {
    add: add, put: put, putRaw: putRaw, addRaw: addRaw,
    get: get, getAll: getAll, del: del, clear: clear, purgeDeleted: purgeDeleted,
    setSetting: setSetting, getSetting: getSetting,
    syncNow: syncNow, getSyncConf: getSyncConf, getSyncStatus: getSyncStatus,
    startAutoSync: startAutoSync, stopAutoSync: stopAutoSync,
    dedupe: dedupe,
    getFamilyName: getFamilyName, setFamilyName: setFamilyName,
    STORES: STORES, SYNC_TABLES: SYNC_TABLES
  };
})();
