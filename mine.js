/* 家庭管理系统 - 页面：我的 / 设置（支持自定义角色） */
const MinePage = (function() {
  // 内置角色
  const BUILTIN_ROLES = ['爸爸','妈妈','孩子','老人','其他'];

  // 读取全部角色（内置 + 自定义），返回 [{name, builtin}]
  async function loadRoles() {
    const custom = (await DB.getSetting('custom_roles')) || [];
    const builtins = BUILTIN_ROLES.map(function(r) { return { name: r, builtin: true }; });
    const customs = custom.map(function(r) { return { name: r, builtin: false }; });
    return builtins.concat(customs);
  }

  // 角色管理弹窗：新增 / 删除自定义角色
  async function openRoleManager() {
    const roles = await loadRoles();
    const customs = roles.filter(function(r) { return !r.builtin; });
    let html = '<h3>🏷️ 自定义角色</h3>';
    html += '<p style="font-size:12.5px;color:var(--sub);margin-bottom:10px;">除内置角色外，可为家人添加自定义角色（如：儿媳、女婿、闺蜜）。删除自定义角色不影响已使用该角色的成员显示。</p>';
    if (customs.length) {
      html += '<div style="margin-bottom:10px;">';
      customs.forEach(function(r) {
        html += '<div class="kv"><span class="k">' + UI.esc(r.name) + '</span>' +
          '<span class="v"><button class="btn sm ghost" data-del-role="' + UI.esc(r.name) + '">删除</button></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card" style="margin-bottom:10px;"><div class="empty">暂无自定义角色</div></div>';
    }
    html += '<div class="field"><label>新增角色</label><input id="r-name" placeholder="如：儿媳"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">关闭</button><button class="btn" data-add-role="1">添加</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-add-role]').addEventListener('click', async function() {
      const name = document.getElementById('r-name').value.trim();
      if (!name) { UI.toast('请输入角色名称'); return; }
      let custom = (await DB.getSetting('custom_roles')) || [];
      if (custom.indexOf(name) >= 0 || BUILTIN_ROLES.indexOf(name) >= 0) {
        UI.toast('该角色已存在');
        return;
      }
      custom.push(name);
      await DB.setSetting('custom_roles', custom);
      UI.closeModal();
      UI.toast('已添加角色');
      App.render();
    });
    modal.querySelectorAll('[data-del-role]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const name = b.getAttribute('data-del-role');
        let custom = (await DB.getSetting('custom_roles')) || [];
        custom = custom.filter(function(r) { return r !== name; });
        await DB.setSetting('custom_roles', custom);
        UI.closeModal();
        UI.toast('已删除角色');
        App.render();
      });
    });
  }

  async function body() {
    const members = await DB.getAll('members');
    const me = await DB.getSetting('me');
    const sync = await DB.getSetting('sync_conf');
    const city = (await DB.getSetting('city')) || Weather.DEFAULT_CITY;

    let html = '';

    // 家庭成员
    html += '<div class="section-title">👨‍👩‍👧‍👦 家庭成员（人人平等）</div>';
    if (members.length) {
      html += '<div class="card">';
      members.forEach(function(m) {
        html += '<div class="kv">' +
          '<span class="k">' + UI.av(m.role, m.name) + ' ' + UI.esc(m.name) + ' <span style="color:var(--sub);font-size:12px;">' + UI.roleName(m.role) + '</span></span>' +
          '<span class="v">' +
            (me == m.id ? '<span class="pill grn">我</span>' : '') +
            '<button class="btn sm ghost" data-edit-m="' + m.id + '">改</button>' +
            '<button class="btn sm ghost" data-del-m="' + m.id + '">删</button>' +
          '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">👪</span>还没有家庭成员，先添加吧</div></div>';
    }
    html += '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn block" data-new-m="1" style="flex:1 1 140px;">+ 添加家庭成员</button>' +
      '<button class="btn block ghost" data-roles="1" style="flex:1 1 160px;">🏷️ 自定义角色</button>' +
    '</div>';

    // 自定义角色列表
    const roles = await loadRoles();
    html += '<div class="section-title">🏷️ 家庭成员角色</div>';
    html += '<div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap;">';
    if (roles.length) {
      roles.forEach(function(r) {
        html += '<span class="pill ' + (r.builtin ? 'gray' : 'pur') + '">' + UI.esc(r.name) + (r.builtin ? '' : ' <span style="opacity:.7;">·自定义</span>') + '</span>';
      });
    }
    html += '</div></div>';

    // 天气城市（首页实时天气）
    const cityOpts = Object.keys(Weather.CITIES).map(function(c) {
      return '<option value="' + c + '"' + (city === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    html += '<div class="section-title">🌤️ 天气城市</div>';
    html += '<div class="card">' +
      '<div class="kv"><span class="k">首页实时天气</span><span class="v"><select id="m-city" style="width:auto;min-width:120px;">' + cityOpts + '</select></span></div>' +
    '</div>';

    // 通知偏好（演示开关）
    html += '<div class="section-title">🔔 通知偏好</div>';
    html += '<div class="card">';
    ['任务到期','库存不足/临期','旅行出行','点餐/做饭','纪念日'].forEach(function(n) {
      html += '<div class="kv"><span class="k">' + n + '</span><span class="pill grn">开</span></div>';
    });
    html += '</div>';

    // 数据与同步
    html += '<div class="section-title">💾 数据与同步</div>';
    html += '<div class="card">' +
      '<div class="kv"><span class="k">多设备同步</span><span class="v"><span class="pill ' + (sync ? 'grn' : 'gray') + '">' + (sync ? '已配置 Supabase' : '本地模式') + '</span></span></div>' +
      '<div class="kv"><span class="k">导出数据（JSON）</span><button class="btn sm ghost" data-export="1">导出</button></div>' +
      '<div class="kv"><span class="k">同步设置</span><button class="btn sm ghost" data-sync="1">配置</button></div>' +
    '</div>';

    html += '<div style="margin-top:16px;font-size:12px;color:var(--sub);text-align:center;">家庭管理系统 v0.5 定稿 · 本地优先 + 可选 Supabase 云同步</div>';
    return html;
  }

  function openMemberForm(member) {
    // 角色选项：内置 + 自定义
    loadRoles().then(function(roles) {
      const roleOpts = roles.map(function(r) {
        return '<option value="' + r.name + '"' + (member && member.role === r.name ? ' selected' : '') + '>' + r.name + (r.builtin ? '' : '（自定义）') + '</option>';
      }).join('');
      UI.openModal(
        '<h3>' + (member ? '编辑成员' : '添加成员') + '</h3>' +
        '<div class="field"><label>姓名</label><input id="mm-name" value="' + UI.esc(member ? member.name : '') + '" placeholder="如：爸爸"></div>' +
        '<div class="field"><label>角色</label><select id="mm-role">' + roleOpts + '</select></div>' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
      );
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      const roleSel = document.getElementById('mm-role');
      // 根据姓名自动推断角色（新建时友好默认）
      if (!member) {
        const nameInput = document.getElementById('mm-name');
        nameInput.addEventListener('input', function() {
          const n = nameInput.value.trim();
          if (n.indexOf('爸爸') >= 0 || n.indexOf('爸') >= 0) roleSel.value = '爸爸';
          else if (n.indexOf('妈妈') >= 0 || n.indexOf('妈') >= 0) roleSel.value = '妈妈';
          else if (n.indexOf('爷爷') >= 0 || n.indexOf('奶奶') >= 0 || n.indexOf('姥姥') >= 0 || n.indexOf('姥爷') >= 0 || n.indexOf('外公') >= 0 || n.indexOf('外婆') >= 0) roleSel.value = '老人';
          else if (n.indexOf('宝宝') >= 0 || n.indexOf('孩子') >= 0 || n.indexOf('宝贝') >= 0) roleSel.value = '孩子';
        });
      }
      modal.querySelector('[data-save]').addEventListener('click', async function() {
        const name = document.getElementById('mm-name').value.trim();
        if (!name) { UI.toast('请填写姓名'); return; }
        const obj = { name: name, role: document.getElementById('mm-role').value };
        if (member) obj.id = member.id;
        await DB.put('members', obj);
        // 首个成员自动设为"我"
        const me = await DB.getSetting('me');
        if (!me) await DB.setSetting('me', obj.id);
        UI.closeModal();
        UI.toast('已保存');
        App.render();
      });
    });
  }

  async function exportData() {
    const stores = ['members','tasks','inventory_items','trips','packing_items','anniversaries','milestones','meal_plans'];
    const data = {};
    for (const s of stores) {
      data[s] = await DB.getAll(s);
    }
    data._exported = new Date().toISOString();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '家庭管理系统-备份-' + UI.todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    UI.toast('已导出备份');
  }

  function openSyncForm() {
    UI.openModal(
      '<h3>🔗 Supabase 云同步设置</h3>' +
      '<p style="font-size:13px;color:var(--sub);margin-bottom:12px;">填写你在 Supabase 创建的项目地址和 anon key 即可开启多设备云同步（免费档）。留空则为纯本地模式。</p>' +
      '<div class="field"><label>Supabase URL</label><input id="sy-url" placeholder="https://xxxx.supabase.co"></div>' +
      '<div class="field"><label>Anon Key</label><input id="sy-key" placeholder="eyJhbGci..."></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const url = document.getElementById('sy-url').value.trim();
      const key = document.getElementById('sy-key').value.trim();
      await DB.setSetting('sync_conf', { url: url, key: key });
      UI.closeModal();
      if (url && key) {
        UI.toast('已保存同步配置（正式版接入）');
      } else {
        UI.toast('已切换为本地模式');
      }
      App.render();
    });
  }

  async function onAction(e) {
    const t = e.target;
    const nm = t.getAttribute('data-new-m');
    const em = t.getAttribute('data-edit-m');
    const dm = t.getAttribute('data-del-m');
    const ex = t.getAttribute('data-export');
    const sy = t.getAttribute('data-sync');
    const rl = t.getAttribute('data-roles');
    if (nm) openMemberForm(null);
    else if (em) openMemberForm(await DB.get('members', +em));
    else if (dm) {
      const id = +dm;
      UI.openModal('<h3>删除成员</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除这位成员吗？其历史记录仍保留。</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        await DB.del('members', id);
        const me = await DB.getSetting('me');
        if (me == id) await DB.setSetting('me', null);
        UI.closeModal();
        UI.toast('已删除');
        App.render();
      });
    }
    else if (ex) exportData();
    else if (sy) openSyncForm();
    else if (rl) openRoleManager();
  }

  function bind(root) {
    root.addEventListener('click', onAction);
    root.addEventListener('change', async function(e) {
      const t = e.target;
      if (t.id === 'm-city') {
        await DB.setSetting('city', t.value);
        UI.toast('天气城市已切换为 ' + t.value);
      }
    });
  }

  return { body: body, bind: bind };
})();
