/* 语音助手模块 - 卡通小狗
   浮动按钮 + 对话面板 + 本地规则解析 + 语音输入输出
*/
const VoiceAssistant = (function() {
  let panelOpen = false;
  let voiceOutput = true;
  let recognizing = false;
  let recognition = null;

  // 卡通小狗 SVG
  const DOG_SVG = '<svg viewBox="0 0 64 64" width="100%" height="100%">' +
    '<ellipse cx="32" cy="38" rx="20" ry="18" fill="#f5c842"/>' +  // 脸
    '<ellipse cx="18" cy="22" rx="7" ry="10" fill="#e0a820" transform="rotate(-20 18 22)"/>' +  // 左耳
    '<ellipse cx="46" cy="22" rx="7" ry="10" fill="#e0a820" transform="rotate(20 46 22)"/>' +  // 右耳
    '<ellipse cx="18" cy="24" rx="4" ry="6" fill="#f5c842" transform="rotate(-20 18 24)"/>' +
    '<ellipse cx="46" cy="24" rx="4" ry="6" fill="#f5c842" transform="rotate(20 46 24)"/>' +
    '<circle cx="25" cy="36" r="3.5" fill="#2a2a2a"/>' +  // 左眼
    '<circle cx="39" cy="36" r="3.5" fill="#2a2a2a"/>' +  // 右眼
    '<circle cx="26" cy="35" r="1.2" fill="#fff"/>' +
    '<circle cx="40" cy="35" r="1.2" fill="#fff"/>' +
    '<ellipse cx="32" cy="44" rx="4" ry="3" fill="#2a2a2a"/>' +  // 鼻子
    '<path d="M32 47 Q28 52 24 49" stroke="#2a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +  // 嘴
    '<path d="M32 47 Q36 52 40 49" stroke="#2a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="20" cy="42" rx="3" ry="2" fill="#f0a0a0" opacity="0.5"/>' +  // 腮红
    '<ellipse cx="44" cy="42" rx="3" ry="2" fill="#f0a0a0" opacity="0.5"/>' +
    '</svg>';

  async function getName() {
    try {
      const n = await DB.getSetting('voice_name');
      return n || '小汪';
    } catch(e) { return '小汪'; }
  }

  async function setName(name) {
    await DB.setSetting('voice_name', name);
  }

  // 初始化：创建浮动按钮
  function init() {
    if (document.getElementById('voice-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'voice-fab';
    fab.style.cssText = 'position:fixed;right:16px;bottom:80px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#f5c842,#e0a820);box-shadow:0 4px 14px rgba(0,0,0,0.18);cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s;';
    fab.innerHTML = DOG_SVG;
    fab.title = '语音助手';
    fab.addEventListener('click', togglePanel);
    // 呼吸动画
    fab.addEventListener('mouseenter', function() { fab.style.transform = 'scale(1.1)'; });
    fab.addEventListener('mouseleave', function() { fab.style.transform = 'scale(1)'; });
    document.body.appendChild(fab);
  }

  function togglePanel() {
    panelOpen ? closePanel() : openPanel();
  }

  async function openPanel() {
    panelOpen = true;
    const name = await getName();
    const panel = document.createElement('div');
    panel.id = 'voice-panel';
    panel.style.cssText = 'position:fixed;right:16px;bottom:140px;width:320px;max-width:calc(100vw - 32px);height:440px;max-height:calc(100vh - 200px);background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9999;display:flex;flex-direction:column;overflow:hidden;animation:voiceSlide .25s ease;';
    panel.innerHTML =
      '<style>@keyframes voiceSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes wag{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}</style>' +
      // 头部
      '<div style="background:linear-gradient(135deg,#f5c842,#e0a820);padding:12px 14px;display:flex;align-items:center;gap:10px;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;animation:wag 1s ease infinite;">' + DOG_SVG + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-weight:700;font-size:14px;color:#5a4000;" id="voice-title">' + name + '</div>' +
          '<div style="font-size:11px;color:#7a5a10;">在线 · 本地规则版</div>' +
        '</div>' +
        '<button id="voice-settings" style="background:none;border:none;font-size:18px;cursor:pointer;color:#5a4000;padding:4px;">⚙</button>' +
        '<button id="voice-close" style="background:none;border:none;font-size:18px;cursor:pointer;color:#5a4000;padding:4px;">×</button>' +
      '</div>' +
      // 消息区
      '<div id="voice-messages" style="flex:1;overflow-y:auto;padding:12px;background:#faf8f0;"></div>' +
      // 输入区
      '<div style="padding:10px;border-top:1px solid #eee;background:#fff;">' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<button id="voice-mic" style="width:38px;height:38px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;font-size:16px;flex-shrink:0;" title="语音输入">🎤</button>' +
          '<input id="voice-input" type="text" placeholder="和' + name + '说点什么…" style="flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;">' +
          '<button id="voice-send" style="width:38px;height:38px;border-radius:50%;border:none;background:var(--green,#2d8659);color:#fff;cursor:pointer;font-size:14px;flex-shrink:0;">➤</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;font-size:11px;color:#999;">' +
          '<span style="cursor:pointer;" data-quick="记一笔">💰 记一笔</span>' +
          '<span style="cursor:pointer;" data-quick="添加日程">📅 添加日程</span>' +
          '<span style="cursor:pointer;" data-quick="今天天气">☀️ 天气</span>' +
          '<label style="margin-left:auto;cursor:pointer;"><input type="checkbox" id="voice-tts" checked> 语音回复</label>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('#voice-close').addEventListener('click', closePanel);
    panel.querySelector('#voice-settings').addEventListener('click', openSettings);
    panel.querySelector('#voice-send').addEventListener('click', sendMessage);
    panel.querySelector('#voice-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
    panel.querySelector('#voice-mic').addEventListener('click', toggleVoiceInput);
    panel.querySelector('#voice-tts').addEventListener('change', function(e) { voiceOutput = e.target.checked; });
    panel.querySelectorAll('[data-quick]').forEach(function(q) {
      q.addEventListener('click', function() {
        document.getElementById('voice-input').value = q.getAttribute('data-quick');
        sendMessage();
      });
    });

    // 欢迎消息
    addMsg('assistant', '汪汪！我是' + name + '🐶 可以帮你记账、添加日程、查天气，或者聊聊天～');
  }

  function closePanel() {
    panelOpen = false;
    const p = document.getElementById('voice-panel');
    if (p) p.remove();
    if (recognizing && recognition) {
      try { recognition.stop(); } catch(e) {}
    }
  }

  function addMsg(role, text) {
    const container = document.getElementById('voice-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:10px;display:flex;' + (role === 'user' ? 'justify-content:flex-end;' : 'justify-content:flex-start;');
    const bubble = document.createElement('div');
    bubble.style.cssText = 'max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-break:break-word;' +
      (role === 'user' ? 'background:var(--green,#2d8659);color:#fff;border-bottom-right-radius:4px;' : 'background:#fff;border:1px solid #eee;border-bottom-left-radius:4px;');
    bubble.textContent = text;
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (role === 'assistant' && voiceOutput) speak(text);
  }

  async function sendMessage() {
    const input = document.getElementById('voice-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg('user', text);

    // 本地规则解析
    let reply = '';
    try {
      if (typeof AI !== 'undefined' && AI.parseIntent) {
        const intent = await AI.parseIntent(text);
        reply = await handleIntent(intent, text);
      } else {
        reply = fallbackReply(text);
      }
    } catch(e) {
      reply = fallbackReply(text);
    }
    setTimeout(function() { addMsg('assistant', reply); }, 400);
  }

  // 处理意图
  async function handleIntent(intent, rawText) {
    const name = await getName();
    if (!intent || !intent.type || intent.type === 'unknown') {
      // AI 已配置时用智能对话
      if (typeof AI !== 'undefined' && AI.getConf) {
        const conf = await AI.getConf();
        if (conf.enabled) {
          const r = await AI.chat(rawText, '你是一个叫' + name + '的可爱卡通小狗家庭助手，性格活泼，用中文回答，简洁亲切，偶尔用汪星人语气。');
          if (r.ok && r.text) return r.text;
        }
      }
      return fallbackReply(rawText);
    }
    if (intent.type === 'expense') {
      // 记账
      const amount = intent.amount || extractNumber(rawText);
      const category = intent.category || '其他';
      if (amount) {
        try {
          const today = new Date().toISOString().slice(0,10);
          const year = today.slice(0,4);
          // 确保预算存在
          if (typeof FinancePage !== 'undefined' && FinancePage.ensureBudget) {
            await FinancePage.ensureBudget(year);
          }
          await DB.add('transactions', {
            type: 'expense', amount: +amount, category: category,
            note: rawText, date: today, year: year,
            month: today.slice(0,7), recorder: '语音助手'
          });
          return '好的！已记一笔支出 ¥' + amount + '（' + category + '）🐶';
        } catch(e) {
          return '记账失败了，可能财务功能未开启汪…';
        }
      }
      return '你想记多少钱呢？比如"记一笔50元餐饮"汪～';
    }
    if (intent.type === 'task') {
      // 添加日程
      try {
        const today = new Date().toISOString().slice(0,10);
        await DB.add('tasks', {
          title: intent.content || rawText,
          date: intent.date || today,
          time: intent.time || '',
          done: false,
          source: 'voice'
        });
        return '好的！已添加日程：' + (intent.content || rawText) + '🐶';
      } catch(e) {
        return '添加日程失败了汪…';
      }
    }
    if (intent.type === 'trip') {
      return '旅行规划可以在旅行页面创建哦汪～需要我帮你看看已有行程吗？';
    }
    if (intent.type === 'weather') {
      return '天气可以在首页查看哦汪～';
    }
    // 改名
    if (rawText.indexOf('叫你') >= 0 || rawText.indexOf('改名') >= 0 || rawText.indexOf('名字是') >= 0) {
      const m = rawText.match(/叫你(.+?)(?:[，。！？\s]|$)/) || rawText.match(/名字是(.+?)(?:[，。！？\s]|$)/);
      if (m && m[1]) {
        await setName(m[1]);
        document.getElementById('voice-title').textContent = m[1];
        return '好呀！以后我就叫' + m[1] + '啦🐶';
      }
    }
    return fallbackReply(rawText);
  }

  function extractNumber(text) {
    const m = text.match(/(\d+(\.\d+)?)/);
    return m ? m[1] : null;
  }

  function fallbackReply(text) {
    const replies = [
      '汪汪！我听到了，不过这个我还不太会呢～可以试试"记一笔50元"或"添加日程明天开会"',
      '嗯…这个需要我再学习学习汪！目前我会记账、添加日程和简单聊天',
      '汪汪～你说的是"' + text + '"吗？可以说得更具体一点哦',
      '收到！不过我现在是本地规则版，复杂的事情等三期 AI 接入就会啦🐶'
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // 语音输入
  function toggleVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addMsg('assistant', '当前浏览器不支持语音输入汪…可以用文字输入哦');
      return;
    }
    if (recognizing) {
      if (recognition) recognition.stop();
      recognizing = false;
      return;
    }
    recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.onresult = function(e) {
      const text = e.results[0][0].transcript;
      document.getElementById('voice-input').value = text;
      sendMessage();
    };
    recognition.onerror = function() {
      addMsg('assistant', '没听清呢汪…再说一次试试？');
      recognizing = false;
    };
    recognition.onend = function() { recognizing = false; };
    recognition.start();
    recognizing = true;
    addMsg('assistant', '我在听…汪🎤');
  }

  // 语音输出
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1.1;
      u.pitch = 1.3;
      window.speechSynthesis.speak(u);
    } catch(e) {}
  }

  // 设置面板（改名）
  async function openSettings() {
    const name = await getName();
    UI.openModal(
      '<h3>🐶 语音助手设置</h3>' +
      '<div class="field"><label>助手名字</label><input id="va-name" value="' + UI.esc(name) + '" placeholder="如：小汪、旺财"></div>' +
      '<div style="font-size:12px;color:var(--sub);margin-bottom:12px;">当前为本地规则版，支持记账、添加日程、简单对话。AI 智能版将在三期接入。</div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const n = document.getElementById('va-name').value.trim();
      if (n) {
        await setName(n);
        const title = document.getElementById('voice-title');
        if (title) title.textContent = n;
        UI.toast('已改名为' + n);
      }
      UI.closeModal();
    });
  }

  return { init: init, openPanel: openPanel, closePanel: closePanel };
})();
