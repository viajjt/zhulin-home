/* 朱林之家 - 天气工具库
   使用 Open-Meteo 免费 API（无需 key、支持 CORS、全球覆盖）。
   城市可在设置页配置，未配置默认"阳江"（用户所在地）。
   失败时优雅降级：返回 null，调用方显示占位，不影响应用。
*/
const Weather = (function() {
  // 内置常用城市（名称 -> [纬度, 经度]）
  const CITIES = {
    '阳江': [21.85, 111.98],
    '北京': [39.90, 116.41],
    '上海': [31.23, 121.47],
    '广州': [23.13, 113.26],
    '深圳': [22.54, 114.06],
    '成都': [30.57, 104.07],
    '重庆': [29.56, 106.55],
    '西安': [34.34, 108.94],
    '杭州': [30.27, 120.16],
    '南京': [32.06, 118.80],
    '武汉': [30.59, 114.31],
    '长沙': [28.23, 112.94],
    '厦门': [24.48, 118.09],
    '三亚': [18.25, 109.51],
    '昆明': [25.04, 102.71],
    '香港': [22.32, 114.17],
    '澳门': [22.20, 113.55],
    '东京': [35.68, 139.69],
    '首尔': [37.57, 126.98],
    '曼谷': [13.76, 100.50]
  };
  const DEFAULT_CITY = '阳江';

  // WMO 天气代码 -> {emoji, text, grad}（grad 为卡片渐变配色 key）
  const WMO = {
    0:  { emoji:'☀️', text:'晴', grad:'sun' },
    1:  { emoji:'🌤️', text:'基本晴', grad:'sun' },
    2:  { emoji:'⛅', text:'少云', grad:'sun' },
    3:  { emoji:'☁️', text:'阴', grad:'cloud' },
    45: { emoji:'🌫️', text:'雾', grad:'cloud' },
    48: { emoji:'🌫️', text:'雾凇', grad:'cloud' },
    51: { emoji:'🌦️', text:'毛毛雨', grad:'rain' },
    53: { emoji:'🌦️', text:'毛毛雨', grad:'rain' },
    55: { emoji:'🌧️', text:'毛毛雨', grad:'rain' },
    56: { emoji:'🌧️', text:'冻毛毛雨', grad:'rain' },
    57: { emoji:'🌧️', text:'冻毛毛雨', grad:'rain' },
    61: { emoji:'🌧️', text:'小雨', grad:'rain' },
    63: { emoji:'🌧️', text:'中雨', grad:'rain' },
    65: { emoji:'🌧️', text:'大雨', grad:'rain' },
    66: { emoji:'🌧️', text:'冻雨', grad:'rain' },
    67: { emoji:'🌧️', text:'冻雨', grad:'rain' },
    71: { emoji:'🌨️', text:'小雪', grad:'snow' },
    73: { emoji:'🌨️', text:'中雪', grad:'snow' },
    75: { emoji:'❄️', text:'大雪', grad:'snow' },
    77: { emoji:'❄️', text:'雪粒', grad:'snow' },
    80: { emoji:'🌦️', text:'阵雨', grad:'rain' },
    81: { emoji:'🌦️', text:'阵雨', grad:'rain' },
    82: { emoji:'⛈️', text:'强阵雨', grad:'rain' },
    85: { emoji:'🌨️', text:'阵雪', grad:'snow' },
    86: { emoji:'🌨️', text:'阵雪', grad:'snow' },
    95: { emoji:'⛈️', text:'雷阵雨', grad:'storm' },
    96: { emoji:'⛈️', text:'雷暴伴冰雹', grad:'storm' },
    99: { emoji:'⛈️', text:'雷暴伴冰雹', grad:'storm' }
  };

  // 渐变配色（按天气氛围）
  const GRADS = {
    sun:   'linear-gradient(135deg,#FFB75E,#FCE38A)',
    cloud: 'linear-gradient(135deg,#A3C6E8,#CFE6F7)',
    rain:  'linear-gradient(135deg,#7FA8D9,#A9C8EC)',
    snow:  'linear-gradient(135deg,#B9D7EF,#E8F2FA)',
    storm: 'linear-gradient(135deg,#6B7FA8,#9DB1CC)'
  };

  async function getCity() {
    const c = await DB.getSetting('city');
    return c && CITIES[c] ? c : DEFAULT_CITY;
  }

  // 获取当前城市天气；失败返回 null
  async function fetchNow() {
    try {
      const city = await getCity();
      const ll = CITIES[city];
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + ll[0] +
        '&longitude=' + ll[1] +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code' +
        '&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1';
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      const cur = j.current || {};
      const w = WMO[cur.weather_code] || { emoji:'🌈', text:'天气', grad:'sun' };
      return {
        city: city,
        temp: Math.round(cur.temperature_2m),
        feels: Math.round(cur.apparent_temperature),
        hum: cur.relative_humidity_2m,
        code: cur.weather_code,
        emoji: w.emoji,
        text: w.text,
        grad: w.grad,
        tmax: j.daily && j.daily.temperature_2m_max ? Math.round(j.daily.temperature_2m_max[0]) : null,
        tmin: j.daily && j.daily.temperature_2m_min ? Math.round(j.daily.temperature_2m_min[0]) : null
      };
    } catch (e) {
      return null;
    }
  }

  return { fetchNow: fetchNow, getCity: getCity, CITIES: CITIES, WMO: WMO, GRADS: GRADS, DEFAULT_CITY: DEFAULT_CITY };
})();
