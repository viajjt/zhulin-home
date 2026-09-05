/* AI 接口层 - 支持 OpenAI 兼容接口
   未配置时使用本地规则，配置后自动切换为 AI 智能版
*/
const AI = (function() {

  async function getConf() {
    try {
      const c = await DB.getSetting('ai_conf');
      return {
        endpoint: (c && c.endpoint) || '',
        key: (c && c.key) || '',
        model: (c && c.model) || 'gpt-4o-mini',
        enabled: !!(c && c.endpoint && c.key)
      };
    } catch(e) {
      return { endpoint: '', key: '', model: 'gpt-4o-mini', enabled: false };
    }
  }

  // 通用对话接口
  async function chat(prompt, system) {
    const conf = await getConf();
    if (!conf.enabled) {
      return { ok: false, error: 'AI 未配置', text: '' };
    }
    try {
      const url = conf.endpoint.replace(/\/+$/, '') + '/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + conf.key
        },
        body: JSON.stringify({
          model: conf.model,
          messages: [
            { role: 'system', content: system || '你是一个 helpful 的家庭助手，用中文回答，简洁明了。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: 'HTTP ' + res.status + ': ' + errText.substring(0, 100), text: '' };
      }
      const data = await res.json();
      const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
      return { ok: true, text: text.trim() };
    } catch(e) {
      return { ok: false, error: String(e), text: '' };
    }
  }

  // 生成旅行行程
  async function genTrip(dest, days, people, members, transport) {
    const conf = await getConf();
    if (!conf.enabled) {
      return { ok: false, error: 'AI 未配置', lines: [] };
    }
    const prompt = '请为家庭旅行生成每日行程安排：\n' +
      '目的地：' + dest + '\n' +
      '天数：' + days + '天\n' +
      '人数：' + people + '人\n' +
      '成员：' + (members || '成人') + '\n' +
      '交通：' + (transport || '不限') + '\n\n' +
      '要求：\n' +
      '1. 每天分上午和下午/晚上两个时段\n' +
      '2. 适合家庭出行，节奏适中\n' +
      '3. 标注需要预约的景点\n' +
      '4. 最后一天安排返程\n' +
      '输出格式：每天一行，用"上午：... | 下午：..."格式，共' + days + '行，不要其他文字。';
    const r = await chat(prompt, '你是专业的家庭旅行规划师，只输出行程内容，不要解释。');
    if (!r.ok) return r;
    // 解析行程
    const lines = [];
    const rawLines = r.text.split('\n').filter(function(l) { return l.trim(); });
    for (let i = 0; i < days; i++) {
      const line = rawLines[i] || '';
      const parts = line.split(/[|｜]/);
      const morning = (parts[0] || '').replace(/^第.+天[：:]?\s*/, '').replace(/^上午[：:]?\s*/, '').trim();
      const evening = (parts[1] || '').replace(/^下午[：:]?\s*/, '').replace(/^晚上[：:]?\s*/, '').trim();
      lines.push([morning, evening]);
    }
    return { ok: true, lines: lines, raw: r.text };
  }

  // 生成菜品图片（返回图片 URL 或 base64）
  async function genDishImage(dishName) {
    const conf = await getConf();
    if (!conf.enabled) {
      return { ok: false, error: 'AI 未配置', url: '' };
    }
    try {
      const url = conf.endpoint.replace(/\/+$/, '') + '/images/generations';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + conf.key
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: '一道美味的' + dishName + '，专业美食摄影，俯拍，暖色调，高清',
          size: '1024x1024',
          n: 1
        })
      });
      if (!res.ok) {
        // 图片接口可能不支持，尝试用 chat 生成描述
        return { ok: false, error: '图片生成接口不可用（HTTP ' + res.status + '）', url: '' };
      }
      const data = await res.json();
      const imgUrl = data.data && data.data[0] && (data.data[0].url || data.data[0].b64_json);
      if (imgUrl) {
        return { ok: true, url: imgUrl.startsWith('http') ? imgUrl : ('data:image/png;base64,' + imgUrl) };
      }
      return { ok: false, error: '未返回图片', url: '' };
    } catch(e) {
      return { ok: false, error: String(e), url: '' };
    }
  }

  // 意图识别（有 AI 时用 AI，无 AI 时用本地规则）
  async function parseIntent(text) {
    const conf = await getConf();
    if (conf.enabled) {
      // AI 意图识别
      const prompt = '分析以下用户输入，识别意图。只返回 JSON，不要其他文字：\n' +
        '{"type":"expense|income|task|trip|weather|unknown","amount":数字或null,"category":"分类","content":"内容","date":"YYYY-MM-DD或空","time":"HH:MM或空"}\n\n' +
        '用户输入：' + text;
      const r = await chat(prompt, '你是意图识别引擎，只返回 JSON。');
      if (r.ok) {
        try {
          const jsonMatch = r.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch(e) {}
      }
    }
    // 本地规则兜底
    return localParseIntent(text);
  }

  function localParseIntent(text) {
    const t = (text || '').trim();
    const moneyMatch = t.match(/(\d+(?:\.\d+)?)/);
    if (/记|花|支出|收入|工资|赚了|报销/.test(t) && moneyMatch) {
      const isIncome = /收入|工资|赚|报销/.test(t);
      let category = '其他';
      if (/餐|饭|吃|菜|水果|零食/.test(t)) category = '餐饮';
      else if (/打车|地铁|公交|油|停车|交通|高铁|机票|火车/.test(t)) category = '交通';
      else if (/购物|衣服|鞋|包|淘宝|京东/.test(t)) category = '购物';
      else if (/房|租|水电|物业|燃气/.test(t)) category = '居家';
      else if (/药|医院|体检|保险/.test(t)) category = '医疗';
      else if (/孩子|学费|玩具|奶粉/.test(t)) category = '育儿';
      else if (/娱乐|电影|游戏|旅游|门票/.test(t)) category = '娱乐';
      return { type: isIncome ? 'income' : 'expense', amount: parseFloat(moneyMatch[1]), category: category, content: t };
    }
    if (/点|号|周|明天|今天|后天|提醒|安排|约会|接|交|会议/.test(t)) {
      let time = '';
      const timeMatch = t.match(/(\d{1,2})[:：点](\d{2})?/);
      if (timeMatch) time = timeMatch[1] + ':' + (timeMatch[2] || '00');
      let date = '';
      if (/明天/.test(t)) date = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      else if (/后天/.test(t)) date = new Date(Date.now() + 172800000).toISOString().slice(0,10);
      else if (/今天/.test(t)) date = new Date().toISOString().slice(0,10);
      return { type: 'task', content: t, date: date, time: time };
    }
    if (/天气|气温|下雨|温度/.test(t)) return { type: 'weather' };
    if (/去|玩|旅行|旅游|出游/.test(t)) return { type: 'trip', content: t };
    return { type: 'unknown', content: t };
  }

  return {
    chat: chat,
    genTrip: genTrip,
    genDishImage: genDishImage,
    parseIntent: parseIntent,
    getConf: getConf
  };
})();
