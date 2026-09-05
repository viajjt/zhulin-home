/* 家庭管理系统 - 数据存储层
   本地优先：IndexedDB 存储所有数据，离线可用。
   预留 Supabase 同步：DB.sync = { enabled, url, key } 配置后启用云同步（见 README）。
   store 约定：families, members, tasks, inventory_items, trips, packing_items,
               anniversaries, milestones, dishes, meal_plans, meal_templates,
               shopping_items（点餐并入的采购清单）, settings
*/
const DB = (function() {
  const DB_NAME = 'family-hub';
  const DB_VER = 2;
  const STORES = [
    'families','members','tasks','inventory_items',
    'trips','packing_items','anniversaries','milestones',
    'dishes','meal_plans','meal_templates','settings','shopping_items'
  ];
  let db = null;

  // Supabase 同步配置（可填，见 README；为空则纯本地）
  const sync = {
    enabled: false,
    url: '',
    key: ''
  };

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
    const d = await open();
    const o = Object.assign({}, obj, { created: Date.now(), updated: Date.now() });
    return new Promise(function(res, rej) {
      const r = tx(store, 'readwrite').add(o);
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
  }

  async function put(store, obj) {
    const d = await open();
    const o = Object.assign({}, obj, { updated: Date.now() });
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

  return {
    sync: sync,
    add: add, put: put, get: get, getAll: getAll, del: del, clear: clear,
    setSetting: setSetting, getSetting: getSetting
  };
})();
