/* 朱林之家 - 农历工具库（1900-2100 公历/农历互转）
   基于标准 lunarInfo 数据表（1900-2100，201 项），离线可用。
   数据来源：流传广泛的标准农历历法表（与主流农历库一致）。
*/
const Lunar = (function() {
  // 农历 1900-2100 的闰大小信息表（201 项）
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04bdb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ];
  const solarMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const TIAN = ['日','一','二','三','四','五','六','七','八','九','十'];
  const nStr1 = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
  const nStr2 = ['初','十','廿','卅'];
  const nStr3 = ['一','二','三','四','五','六','七','八','九'];

  function lYearDays(y) {
    let i, sum = 348;
    for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + leapDays(y);
  }
  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
  function leapDays(y) {
    if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }
  function monthDays(y, m) {
    return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29;
  }
  // 当年某月前的天数（含闰月）
  function lMonthDays(y, m) {
    let sum = 0;
    for (let i = 1; i < m; i++) {
      sum += monthDays(y, i);
      if (leapMonth(y) === i) sum += leapDays(y);
    }
    return sum;
  }

  // 公历 → 农历（date: Date 或 'YYYY-MM-DD'）返回 {lYear,lMonth,lDay,isLeap}
  function solar2lunar(input) {
    const d = typeof input === 'string' ? new Date(input + 'T00:00:00') : input;
    const base = new Date(1900, 0, 31); // 1900-01-31 = 农历1900正月初一
    let offset = Math.floor((d - base) / 86400000);
    let year = 1900;
    let ydays = 0;
    while (year < 2101) {
      ydays = lYearDays(year);
      if (offset < ydays) break;
      offset -= ydays;
      year++;
    }
    const leap = leapMonth(year);
    let isLeap = false;
    let month = 1;
    let mdays;
    // 逐月扣减：月份序列中闰月插在 normal 月之后（即 leap 月的下一位置）
    while (month <= 12) {
      mdays = monthDays(year, month);
      if (offset < mdays) break;
      offset -= mdays;
      if (month === leap) {
        // 闰月跟在 normal 月之后
        const ldays = leapDays(year);
        if (offset < ldays) { isLeap = true; mdays = ldays; break; }
        offset -= ldays;
      }
      month++;
    }
    const day = offset + 1;
    return { lYear: year, lMonth: month, lDay: day, isLeap: isLeap };
  }

  // 农历 → 公历（lYear, lMonth, lDay, isLeap）返回 {year, month, day}
  function lunar2solar(lYear, lMonth, lDay, isLeap) {
    if (lMonth < 1 || lMonth > 12 || lDay < 1 || lDay > 30) {
      throw new Error('invalid lunar date');
    }
    if (isLeap && leapMonth(lYear) !== lMonth) {
      throw new Error('no such leap month');
    }
    let offset = 0;
    for (let y = 1900; y < lYear; y++) offset += lYearDays(y);
    const leap = leapMonth(lYear);
    // 累加 lMonth 之前的所有月份（闰月跟在 normal 月之后）
    for (let m = 1; m < lMonth; m++) {
      offset += monthDays(lYear, m);
      if (m === leap) offset += leapDays(lYear);
    }
    // 若指定的是闰月本身：还需加上其前一个 normal 月
    if (isLeap) {
      offset += monthDays(lYear, lMonth);
    }
    const solar = new Date(1900, 0, 31);
    solar.setDate(solar.getDate() + offset + lDay - 1);
    return { year: solar.getFullYear(), month: solar.getMonth() + 1, day: solar.getDate() };
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 中文月份
  function cnMonth(m) { return nStr1[m - 1] + '月'; }
  // 中文日期
  function cnDay(d) {
    if (d < 10) return '初' + nStr3[d - 1];       // 初一..初九
    if (d === 10) return '初十';
    if (d === 20) return '二十';
    if (d === 30) return '三十';
    if (d > 20) return '廿' + nStr3[d - 21];      // 廿一..廿九
    if (d > 10) return '十' + nStr3[d - 11];      // 十一..十九
    return String(d);
  }
  // 中文年份（如"二零二六"）
  function cnYear(y) {
    const nums = ['零','一','二','三','四','五','六','七','八','九'];
    return String(y).split('').map(function(ch) { return nums[+ch]; }).join('');
  }
  // 农历格式串：如 "农历二〇二六年 八月廿三"
  function fmt(l) {
    return '农历' + cnYear(l.lYear) + '年 ' + (l.isLeap ? '闰' : '') + cnMonth(l.lMonth) + cnDay(l.lDay);
  }

  // 某农历月日（如 8-23）在接下来最近的公历日期（供生日倒计时）
  // 闰月生日：若近两年有该闰月则按闰月庆祝；否则回退到普通月（避免长时间无解）
  // 返回 {solarDate:'YYYY-MM-DD', lMonth, lDay, year, isLeap} 或 null（极端无解）
  function nextSolarDate(month, day, isLeap) {
    const now = new Date();
    const cur = now.getFullYear();
    // 优先：如果指定闰月，先找近两年的闰月
    if (isLeap) {
      for (let y = cur; y <= cur + 1; y++) {
        if (leapMonth(y) === month) {
          try {
            const s = lunar2solar(y, month, day, true);
            return { solarDate: s.year + '-' + pad(s.month) + '-' + pad(s.day), year: y, lMonth: month, lDay: day, isLeap: true };
          } catch (e) { /* 继续 */ }
        }
      }
      // 无闰月可过，回退到普通月
      isLeap = false;
    }
    for (let y = cur; y <= cur + 1; y++) {
      try {
        const s = lunar2solar(y, month, day, isLeap);
        return { solarDate: s.year + '-' + pad(s.month) + '-' + pad(s.day), year: y, lMonth: month, lDay: day, isLeap: isLeap };
      } catch (e) { /* 非法组合，尝试下一年 */ }
    }
    return null;
  }

  // 今天的农历
  function today() {
    return solar2lunar(new Date());
  }

  return {
    solar2lunar: solar2lunar,
    lunar2solar: lunar2solar,
    cnMonth: cnMonth,
    cnDay: cnDay,
    cnYear: cnYear,
    fmt: fmt,
    nextSolarDate: nextSolarDate,
    today: today
  };
})();
