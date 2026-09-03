// ============================================================
// StepForward Demo · 主应用逻辑 v2.0.1
// ============================================================
// v2.0 更新：
//   - 主界面重构：只显示下一个待办
//   - 待办/已完成按大任务分组
//   - 步骤修改/删除功能（⋮ 按钮）
//   - 多任务独立拆解 + 工作时间约束
//   - 多角色 AI 调用
//   - 语音输入 + 音频输出
//   - 角色气质自定义设置
//   - 恢复初始状态
// ============================================================

// ===== 数据存储 =====
const STORAGE_KEY = 'stepforward_data';
const SETTINGS_KEY = 'stepforward_settings';

/**
 * 从 localStorage 读取应用数据
 * @returns {Object} 包含 tasks、diary、moods 的数据对象
 */
function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { tasks: [], diary: [], moods: [] };
    console.log('[getData] 读取数据完成，任务数:', data.tasks.length, '日记数:', (data.diary || []).length);
    return data;
  } catch (e) {
    console.warn('[getData] 读取数据失败，返回默认值:', e);
    return { tasks: [], diary: [], moods: [] };
  }
}

/**
 * 将应用数据保存到 localStorage
 * @param {Object} data - 要保存的数据对象
 */
function saveData(data) {
  console.log('[saveData] 保存数据，任务数:', data.tasks.length);
  if (window._saveDataTimer) {
    clearTimeout(window._saveDataTimer);
  }
  window._saveDataPending = data;
  window._saveDataTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window._saveDataPending));
    window._saveDataTimer = null;
    console.log('[saveData] 节流写入完成');
  }, 200);
}

/**
 * 同步保存数据到 localStorage（绕过节流，立即写入）
 * 用于批量操作等需要立即生效的场景
 * @param {Object} data - 要保存的数据对象
 */
function saveDataSync(data) {
  if (window._saveDataTimer) {
    clearTimeout(window._saveDataTimer);
    window._saveDataTimer = null;
  }
  window._saveDataPending = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  console.log('[saveDataSync] 同步写入完成，任务数:', data.tasks.length);
}

/**
 * 从 localStorage 读取用户设置，与默认值合并后返回
 * @returns {Object} 包含所有设置项的配置对象
 */
function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = {
      userName: '', autoReschedule: true, workStart: 9, workEnd: 18,
      remindIntensity: 'standard', soundEnabled: true, voiceEnabled: true,
      personaAge: '', personaGender: '', personaStyle: '', personaRelation: '',
      lunchStart: '12:00', lunchDuration: 90,
      dinnerStart: '18:00', dinnerDuration: 90,
      theme: 'default', themeMode: 'system',
      diaryAIResponse: true, bedtimeReminder: false, bedtimeTime: '22:30', diaryCardVisual: true,
      mascot: 'cat'
    };
    const settings = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    console.log('[getSettings] 读取设置完成，userName:', settings.userName || '(未设置)');
    return settings;
  } catch (e) {
    console.warn('[getSettings] 读取设置失败，返回默认值:', e);
    return { userName: '', autoReschedule: true, workStart: 9, workEnd: 18, remindIntensity: 'standard', soundEnabled: true, voiceEnabled: true, personaAge: '', personaGender: '', personaStyle: '', personaRelation: '', lunchStart: '12:00', lunchDuration: 90, dinnerStart: '18:00', dinnerDuration: 90, theme: 'default', themeMode: 'system', diaryAIResponse: true, bedtimeReminder: false, bedtimeTime: '22:30', diaryCardVisual: true, mascot: 'cat' };
  }
}

/**
 * 将用户设置保存到 localStorage
 * @param {Object} s - 要保存的设置对象
 */
function saveSettings(s) {
  console.log('[saveSettings] 保存设置');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ===== 工具函数 =====

/**
 * DOM 查询快捷方式，返回第一个匹配元素
 * @param {string} sel - CSS 选择器
 * @returns {Element|null} 匹配的 DOM 元素
 */
function $(sel) { return document.querySelector(sel); }

/**
 * DOM 查询快捷方式，返回所有匹配元素
 * @param {string} sel - CSS 选择器
 * @returns {NodeList} 匹配的 DOM 元素列表
 */
function $$(sel) { return document.querySelectorAll(sel); }

/**
 * 将 Markdown 文本渲染为 HTML
 * @param {string} text - Markdown 源文本
 * @returns {string} 渲染后的 HTML 字符串
 */
function md(text) { return window.SF_Markdown.renderMarkdown(text); }

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param {string} text - 原始文本
 * @returns {string} 转义后的安全 HTML 字符串
 */
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

/**
 * 创建 DOM 元素的工具函数
 * @param {string} tag - 标签名
 * @param {string} [className] - CSS 类名
 * @param {string} [html] - 元素的 innerHTML
 * @returns {Element} 新创建的 DOM 元素
 */
function createEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  // 动态创建的弹窗打上时间戳，供看门狗清理"隐形残留弹窗"使用
  if (tag === 'div' && className && String(className).includes('modal-overlay')) {
    el.dataset.created = Date.now();
  }
  return el;
}

/**
 * 显示顶部浮动提示消息（Toast）
 * @param {string} message - 提示内容
 * @param {string} [type='info'] - 提示类型：info / success / error
 */
function showToast(message, type = 'info') {
  console.log('[showToast] 显示提示:', message, '类型:', type);
  const toast = createEl('div', 'toast');
  if (type !== 'info') toast.classList.add(type);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

/**
 * 将文本复制到剪贴板（兼容 file:// 协议）
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否复制成功返回 true
 */
async function copyToClipboard(text) {
  // 优先使用现代 API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('[copyToClipboard] navigator.clipboard 失败，降级:', e);
    }
  }
  // 降级方案：textarea + execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    console.error('[copyToClipboard] 复制失败:', e);
    return false;
  }
}

// ===== 自定义确认弹窗（替代 confirm，兼容沙盒环境）=====

/**
 * 显示自定义确认对话框（替代原生 confirm）
 * @param {string} message - 确认提示内容
 * @param {Function} onYes - 用户点击"确定"时的回调
 * @param {Function} [onNo] - 用户点击"取消"或关闭时的回调
 */
function showConfirm(message, onYes, onNo) {
  console.log('[showConfirm] 显示确认框:', message);
  const overlay = createEl('div', 'modal-overlay');
  overlay.style.zIndex = '9999';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '380px';
  modal.innerHTML = `
    <div style="font-size:14px;line-height:1.7;color:var(--ink);margin-bottom:20px;white-space:pre-wrap;">${escapeHtml(message)}</div>
    <div style="display:flex;gap:10px;">
      <button class="action-btn secondary" style="flex:1;" id="customConfirmNo">取消</button>
      <button class="action-btn primary" style="flex:1;" id="customConfirmYes">确定</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.onclick = function(e) {
    if (e.target === overlay) {
      overlay.remove();
      if (onNo) onNo();
    }
  };

  $('#customConfirmYes').onclick = function() {
    overlay.remove();
    if (onYes) onYes();
  };

  $('#customConfirmNo').onclick = function() {
    overlay.remove();
    if (onNo) onNo();
  };

  // 下一帧添加 .show，触发淡入过渡
  requestAnimationFrame(function() { overlay.classList.add('show'); });
}

/**
 * 将 Date 对象格式化为 HH:MM 时间字符串
 * @param {Date} date - 日期对象
 * @returns {string} HH:MM 格式的时间字符串
 */
function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD 字符串
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD 格式的日期字符串
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ===== 骨架屏控制 =====

let skeletonStartTime = 0;
const SKELETON_MIN_DURATION = 300; // 最少显示 300ms

/**
 * 显示首屏骨架屏
 */
function showSkeleton() {
  const skeleton = $('#appSkeleton');
  if (skeleton) {
    skeleton.style.display = 'block';
    skeletonStartTime = Date.now();
  }
}

/**
 * 隐藏首屏骨架屏（确保最少显示时间，避免闪烁）
 */
function hideSkeleton() {
  const skeleton = $('#appSkeleton');
  if (!skeleton) return;
  const elapsed = Date.now() - skeletonStartTime;
  const remaining = Math.max(0, SKELETON_MIN_DURATION - elapsed);
  setTimeout(() => {
    if (skeleton.parentNode) {
      skeleton.style.display = 'none';
    }
  }, remaining);
}

/**
 * 获取今日的 YYYY-MM-DD 字符串
 * @returns {string} 今日日期字符串
 */
function todayDateStr() {
  return formatDate(new Date());
}

/**
 * 规范化日记条目，确保旧数据也有 date 字段
 * 旧数据缺失 date 时，从 timestamp 推导
 * @param {Object} entry - 日记条目
 * @returns {Object} 带 date 字段的日记条目
 */
function normalizeDiaryEntry(entry) {
  if (!entry) return entry;
  if (!entry.date && entry.timestamp) {
    try { entry.date = formatDate(new Date(entry.timestamp)); } catch (e) { entry.date = todayDateStr(); }
  }
  return entry;
}

/**
 * 将日期字符串 + 时间字符串解析为 Date 对象
 * @param {string} dateStr - YYYY-MM-DD 格式的日期字符串（可选，为空则用今日）
 * @param {string} timeStr - HH:MM 格式的时间字符串
 * @returns {Date|null} 解析后的日期对象
 */
function parseScheduledDateTime(dateStr, timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const d = new Date();
  if (dateStr) {
    const dateParts = dateStr.split('-');
    if (dateParts.length === 3) {
      d.setFullYear(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    }
  }
  d.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
  return d;
}

/**
 * 格式化日期+时间为友好的显示格式
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 * @returns {string} 如 "今天 14:30" 或 "明天 09:00" 或 "8月5日 15:00"
 */
function formatScheduledDisplay(dateStr, timeStr) {
  if (!timeStr) return '未安排';
  let prefix = '';
  if (dateStr) {
    const today = todayDateStr();
    const tomorrow = formatDate(new Date(Date.now() + 86400000));
    if (dateStr === today) prefix = '今天 ';
    else if (dateStr === tomorrow) prefix = '明天 ';
    else {
      const d = new Date(dateStr);
      prefix = `${d.getMonth() + 1}月${d.getDate()}日 `;
    }
  }
  return prefix + timeStr;
}

/**
 * 将 HH:MM 时间字符串解析为今日的 Date 对象
 * @param {string} str - HH:MM 格式的时间字符串
 * @returns {Date|null} 解析后的日期对象，解析失败返回 null
 */
function parseTimeStr(str) {
  if (!str) return null;
  const parts = str.split(':');
  if (parts.length !== 2) return null;
  const d = new Date();
  d.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
  return d;
}

/**
 * 获取今日的中文日期字符串（含星期）
 * @returns {string} 如 "2024年1月15日 · 周一"
 */
function todayStr() {
  const d = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
}

// ===== 音频输出 =====

/**
 * 播放通知提示音（使用 Web Audio API 生成柔和提示音）
 */
function playNotificationSound() {
  const s = getSettings();
  if (!s.soundEnabled) {
    console.log('[playNotificationSound] 声音已关闭，跳过播放');
    return;
  }
  try {
    console.log('[playNotificationSound] 播放提示音');
    // 用 Web Audio API 生成柔和的提示音
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 520; osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch (e) { console.warn('[playNotificationSound] 音频播放失败:', e); }
}

// ===== 小庆祝动画（完成单个步骤）=====

/**
 * 播放小庆祝动画（在屏幕上飘出星星等 emoji）
 */
function playSmallCelebration() {
  console.log('[playSmallCelebration] 播放小庆祝动画');
  var emojis = ['✨', '🌟', '⭐', '💫', '🌸'];
  for (var i = 0; i < 6; i++) {
    (function(idx) {
      setTimeout(function() {
        var c = document.createElement('div');
        var x = 30 + Math.random() * 40;
        var y = 40 + Math.random() * 20;
        c.style.cssText = 'position:fixed;top:' + y + '%;left:' + x + '%;font-size:' + (24 + Math.random() * 16) + 'px;z-index:9999;pointer-events:none;animation:celebrate-float 1.2s ease-out forwards;';
        c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        document.body.appendChild(c);
        setTimeout(function() { c.remove(); }, 1500);
      }, idx * 60);
    })(i);
  }
}

/**
 * 使用浏览器语音合成播报文字
 * @param {string} text - 要播报的文字内容
 */
function speakText(text) {
  const s = getSettings();
  if (!s.voiceEnabled || !('speechSynthesis' in window)) {
    console.log('[speakText] 语音已关闭或浏览器不支持，跳过播报');
    return;
  }
  console.log('[speakText] 语音播报:', text);
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 0.9;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (e) { console.warn('[speakText] 语音播报失败:', e); }
}

// ===== 核心：任务拆解 =====

// 存储当前的拆解会话状态
let currentBreakdown = {
  originalInput: '',     // 用户原始输入
  parsedResult: null,    // AI 解析后的拆解结果
  revisionHistory: [],   // 修改历史（对话记录）
};

// ===== 清单筛选状态 =====
let listFilterState = { type: 'today', dateStart: null, dateEnd: null };
let currentListType = 'pending';

/**
 * 前端关键词兜底校验（方案5）
 * 在 AI 返回拆解结果后，用硬代码做最后一道防线：
 * 1. 吃饭/睡觉类任务被排出对应时段 → 修正
 * 2. 用户说了"现在/马上"但 AI 没听 → 第一个步骤时间修正为当前时间
 */
function applyScheduleFallback(parsed, userInput, settings) {
  const now = new Date();
  const currentTimeStr = formatTime(now);
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

  // 关键词定义
  const mealKeywords = ['吃饭', '午饭', '午餐', '晚饭', '晚餐', '用餐', '干饭', '觅食', '吃饭了', '饭点'];
  const sleepKeywords = ['睡觉', '午睡', '午休', '休息', '入睡', '睡觉了', 'nap'];
  const nowKeywords = ['现在', '马上', '立刻', '立马', '此刻'];

  // 用餐时段（从设置读取）
  const lunchStart = settings?.lunchStart || '12:00';
  const lunchDuration = settings?.lunchDuration ?? 90;
  const dinnerStart = settings?.dinnerStart || '18:00';
  const dinnerDuration = settings?.dinnerDuration ?? 90;

  const toMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
  };

  const lunchEndMin = toMinutes(lunchStart) + lunchDuration;
  const dinnerEndMin = toMinutes(dinnerStart) + dinnerDuration;

  const isInLunchTime = (timeStr) => {
    const t = toMinutes(timeStr);
    if (t === null) return false;
    return t >= toMinutes(lunchStart) && t <= lunchEndMin;
  };

  const isInDinnerTime = (timeStr) => {
    const t = toMinutes(timeStr);
    if (t === null) return false;
    return t >= toMinutes(dinnerStart) && t <= dinnerEndMin;
  };

  const userSaidNow = nowKeywords.some(kw => userInput.includes(kw));
  const userLower = userInput.toLowerCase();

  let corrected = 0;

  parsed.tasks.forEach(task => {
    const taskName = (task.parentTask || '').toLowerCase();
    const isMealTask = mealKeywords.some(kw => taskName.includes(kw));
    const isSleepTask = sleepKeywords.some(kw => taskName.includes(kw));

    // 校验1：吃饭类任务应安排在用餐时段
    if (isMealTask && task.steps && task.steps.length > 0) {
      const firstStep = task.steps[0];
      if (firstStep.time && !isInLunchTime(firstStep.time) && !isInDinnerTime(firstStep.time)) {
        // 判断是午饭还是晚饭
        const isLunch = taskName.includes('午') || taskName.includes('中午');
        const isDinner = taskName.includes('晚') || taskName.includes('夜');
        if (isLunch && !isDinner) {
          firstStep.time = lunchStart;
          corrected++;
        } else if (isDinner) {
          firstStep.time = dinnerStart;
          corrected++;
        } else {
          // 模糊的"吃饭"，默认放午餐
          firstStep.time = lunchStart;
          corrected++;
        }
      }
    }

    // 校验2：睡觉/午休类任务应安排在中午饭后或晚间
    if (isSleepTask && task.steps && task.steps.length > 0) {
      const firstStep = task.steps[0];
      const isNap = taskName.includes('午');
      if (isNap && firstStep.time) {
        const t = toMinutes(firstStep.time);
        // 午休应该在午饭后（lunchEndMin 之后）
        if (t !== null && t < lunchEndMin) {
          // 推到午餐结束时间
          const h = Math.floor(lunchEndMin / 60);
          const m = lunchEndMin % 60;
          firstStep.time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
          corrected++;
        }
      }
    }

    // 校验3：用户说了"现在/马上"但第一个步骤不是当前时间附近
    if (userSaidNow && task.steps && task.steps.length > 0) {
      const firstStep = task.steps[0];
      const nowMin = toMinutes(currentTimeStr);
      const stepMin = toMinutes(firstStep.time);
      if (stepMin !== null && Math.abs(stepMin - nowMin) > 120) {
        // 偏差超过 2 小时，说明 AI 没听"现在"
        firstStep.time = currentTimeStr;
        firstStep.date = todayStr;
        corrected++;
      }
    }
  });

  if (corrected > 0) {
    console.log('[applyScheduleFallback] 兜底修正了', corrected, '处时间安排');
  }
}

/**
 * 调用 AI 将用户输入的任务拆解为多个小步骤（不保存，仅返回解析结果）
 * @param {string} taskInput - 用户输入的原始任务描述
 * @param {string} [revisionFeedback] - 用户的修改反馈（如果是重新拆解）
 * @returns {Promise<Object>} 解析后的拆解结果 { tasks: [{ parentTask, steps: [{text, duration, time}] }] }
 */
async function callBreakdownAI(taskInput, revisionFeedback) {
  console.log('[callBreakdownAI] 调用 AI 拆解，输入:', taskInput, revisionFeedback ? '，有修改反馈' : '');
  const settings = getSettings();

  let prompt = SF_PROMPT.buildTaskPlannerPrompt(settings) + `\n\n用户输入：${taskInput}`;
  if (revisionFeedback && currentBreakdown.revisionHistory.length > 0) {
    const historyStr = currentBreakdown.revisionHistory
      .map(h => `${h.role === 'user' ? '用户' : '你'}: ${h.content}`)
      .join('\n');
    prompt += `\n\n【之前的拆解方案需要修改】\n之前的对话修改历史：\n${historyStr}\n\n用户最新修改意见：${revisionFeedback}\n\n请根据以上修改意见重新拆解任务，只返回 JSON。`;
  }

  const result = await SF_API.callAI(
    [{ role: 'user', content: prompt }],
    '你是任务拆解助手。只返回 JSON。',
    null,
    { json: true }
  );

  // 空内容直接报错，不再静默回显原始输入
  if (!result || !result.trim()) {
    throw new Error('AI 返回内容为空，请重试或检查 API 配置');
  }

  let parsed;
  // JSON 提取增强：先剥离 markdown 围栏，再截取第一个 { 到最后一个 } 之间的内容
  let cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    parsed = JSON.parse(cleaned);
    console.log('[callBreakdownAI] JSON 解析成功，任务组数:', parsed.tasks ? parsed.tasks.length : 0);
  } catch (e) {
    console.warn('[callBreakdownAI] JSON 解析失败，尝试提取编号步骤:', result);
    const numberedSteps = result.split('\n')
      .filter(l => l.trim() && l.match(/^\d+[\.\)]/))
      .slice(0, 5)
      .map(l => ({ text: l.replace(/^\d+[\.\)]\s*/, '').trim(), duration: 10, time: null }));
    if (numberedSteps.length > 0) {
      parsed = { tasks: [{ parentTask: taskInput, steps: numberedSteps }] };
    } else {
      // 既不是合法 JSON 也没有可提取的编号步骤 → 明确抛错，不再静默回显原始输入
      throw new Error('AI 返回的拆解结果无法解析，请重试或检查 API 配置');
    }
  }

  if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error('AI 返回的拆解结果为空，请重试');
  }

  // 前端关键词兜底校验（方案5）
  applyScheduleFallback(parsed, taskInput, settings);

  return parsed;
}

/**
 * 将拆解结果保存到数据存储
 * @param {Object} parsed - 拆解结果对象
 */
function saveBreakdownResult(parsed) {
  console.log('[saveBreakdownResult] 保存拆解结果');
  const data = getData();
  const now = Date.now();
  let stepIndex = 0;

  parsed.tasks.forEach(parentTask => {
    console.log('[saveBreakdownResult] 母任务:', parentTask.parentTask, '步骤数:', parentTask.steps.length);
    parentTask.steps.forEach(step => {
      data.tasks.push({
        id: now + stepIndex,
        parentTask: parentTask.parentTask,
        text: step.text,
        duration: step.duration || 10,
        scheduledTime: step.time || null,
        scheduledDate: step.date || null,
        breakAfter: step.breakAfter || false,
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        reminded: false,
      });
      stepIndex++;
    });
  });

  saveDataSync(data);
  updateCounters();
  scheduleReminders();

  // 缓冲后再渲染任务卡片
  showTaskBufferMessage(2, () => {
    renderNextTask();
  });

  // 行为画像埋点
  try {
    parsed.tasks.forEach(pt => window.SF_PROFILE.trackTaskCreated({ text: pt.parentTask }));
  } catch (e) { console.warn('[saveBreakdownResult] 画像埋点失败:', e); }
  console.log('[saveBreakdownResult] 保存完成，共', stepIndex, '个步骤');
  return stepIndex;
}

/**
 * 显示任务缓冲提示消息
 * @param {number} seconds - 缓冲秒数
 * @param {Function} callback - 缓冲结束后执行的回调
 */
function showTaskBufferMessage(seconds, callback) {
  const container = $('#nextTaskContainer');
  if (!container) {
    if (callback) callback();
    return;
  }

  // 显示缓冲消息（吉祥物 + 倒计时）
  const bufferDiv = document.createElement('div');
  bufferDiv.id = 'taskBufferMessage';
  bufferDiv.style.cssText = 'padding:24px 20px;text-align:center;background:linear-gradient(135deg,var(--warm-bg),var(--bg));border-radius:14px;margin-bottom:16px;';
  bufferDiv.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:12px;">${getMascotSVG(getCurrentMascot())}</div>
    <div style="font-size:16px;color:var(--accent2);font-weight:600;margin-bottom:8px;">
      卡片将在 <span id="bufferCountdown">${seconds}</span> 秒后提醒
    </div>
    <div style="font-size:14px;color:var(--ink);line-height:1.7;">
      我会一直在这里和你一起，加油 ~
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(bufferDiv);

  // 倒计时
  let remaining = seconds;
  const countdownEl = document.getElementById('bufferCountdown');
  const timer = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(timer);
      if (callback) callback();
    }
  }, 1000);
}

/**
 * 显示拆解预览弹窗（整合对话修改功能）
 * 用户可以在弹窗内预览拆解结果、与AI对话修改，直到满意后确认
 * @param {Object} parsed - 拆解结果
 */
function showBreakdownPreview(parsed) {
  console.log('[showBreakdownPreview] 显示拆解预览弹窗（整合对话）');
  currentBreakdown.parsedResult = parsed;
  let currentParsed = parsed; // 当前显示的拆解结果（可能经过多轮修改）
  let chatMode = false; // 是否处于对话修改模式

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show');
  overlay.style.zIndex = '9997';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '520px';

  // 构建预览内容的辅助函数
  const buildPreviewHtml = (p) => {
    let html = '';
    p.tasks.forEach(parentTask => {
      html += `<div style="margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:6px;">📌 ${escapeHtml(parentTask.parentTask)}</div>
        <div style="padding-left:8px;border-left:2px solid var(--accent-soft);">`;
      parentTask.steps.forEach((step, idx) => {
        const timeStr = step.time ? ` · ⏰${step.time}` : '';
        const durStr = step.duration ? ` · ${step.duration}分钟` : '';
        html += `<div style="padding:4px 0;font-size:12.5px;line-height:1.6;">
          <span style="color:var(--muted);margin-right:6px;">${idx + 1}.</span>${escapeHtml(step.text)}<span style="color:var(--muted);font-size:11px;">${durStr}${timeStr}</span>
        </div>`;
      });
      html += `</div></div>`;
    });
    return html;
  };

  // 构建对话历史的函数
  const buildChatHistoryHtml = () => {
    if (currentBreakdown.revisionHistory.length === 0) return '';
    let html = '<div style="margin-bottom:12px;">';
    currentBreakdown.revisionHistory.forEach(msg => {
      if (msg.role === 'user') {
        html += `<div style="text-align:right;margin-bottom:8px;">
          <div style="display:inline-block;background:var(--accent3-soft);color:var(--accent3);padding:8px 12px;border-radius:12px 12px 2px 12px;font-size:12.5px;max-width:80%;text-align:left;">${escapeHtml(msg.content)}</div>
        </div>`;
      } else {
        html += `<div style="text-align:left;margin-bottom:8px;">
          <div style="display:inline-block;background:var(--bg2);color:var(--ink);padding:8px 12px;border-radius:12px 12px 12px 2px;font-size:12.5px;max-width:80%;">${escapeHtml(msg.content)}</div>
        </div>`;
      }
    });
    html += '</div>';
    return html;
  };

  // 渲染整个弹窗的函数
  const renderModal = () => {
    const previewHtml = buildPreviewHtml(currentParsed);
    const chatHistoryHtml = buildChatHistoryHtml();

    const chatSectionHtml = chatMode ? `
      <div style="border-top:1px solid var(--rule);padding-top:12px;margin-top:4px;">
        ${chatHistoryHtml}
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="breakdownChatInput" class="api-input" style="flex:1;" placeholder="说说你想怎么改...（比如：把第三步改到下午）">
          <button class="action-btn primary" id="breakdownChatSendBtn" style="flex:0 0 auto;">重新整理</button>
        </div>
        <div id="breakdownChatLoading" style="display:none;text-align:center;padding:8px;color:var(--muted);font-size:12px;">
          <span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent-soft);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span>
          正在根据你的意见重新整理...
        </div>
      </div>
    ` : '';

    const reviseBtnHtml = chatMode
      ? `<button class="action-btn secondary" style="flex:1;" id="breakdownReviseBtn">收起修改 ✏️</button>`
      : `<button class="action-btn secondary" style="flex:1;" id="breakdownReviseBtn">需要改一改 ✏️</button>`;

    modal.innerHTML = `
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      <h3 style="color:var(--accent2);margin-top:0;">我帮你整理成这样，可以吗？</h3>
      <div id="previewSection" style="max-height:45vh;overflow-y:auto;padding:4px 2px;margin-bottom:12px;">
        ${previewHtml}
      </div>
      ${chatSectionHtml}
      <div style="display:flex;gap:10px;">
        ${reviseBtnHtml}
        <button class="action-btn primary" style="flex:1;" id="breakdownConfirmBtn">就按这个办 ✓</button>
      </div>
    `;

    // 重新绑定所有事件
    bindEvents();
  };

  // 绑定事件的函数
  const bindEvents = () => {
    // 确认按钮
    $('#breakdownConfirmBtn').onclick = () => {
      console.log('[showBreakdownPreview] 用户确认拆解方案');
      const parsedToSave = currentParsed;          // 保留引用
      overlay.remove();                              // 先关闭预览弹窗，避免与冲突弹窗叠加
      currentBreakdown = { originalInput: '', parsedResult: null, revisionHistory: [] };
      saveBreakdownWithConflictCheck(parsedToSave);  // 保存前检测冲突（可能弹出冲突弹窗）
      // 触发引导事件：用户确认了任务拆解
      document.dispatchEvent(new CustomEvent('tour:taskConfirmed'));
    };

    // 修改按钮（切换对话模式）
    $('#breakdownReviseBtn').onclick = () => {
      console.log('[showBreakdownPreview] 用户切换修改模式，当前:', chatMode);
      chatMode = !chatMode;
      renderModal();
      // 如果进入对话模式，自动聚焦输入框
      if (chatMode && $('#breakdownChatInput')) {
        $('#breakdownChatInput').focus();
      }
    };

    // 发送修改意见（如果在对话模式）
    if (chatMode && $('#breakdownChatSendBtn')) {
      const sendRevision = async () => {
        const feedback = $('#breakdownChatInput').value.trim();
        if (!feedback) return;

        console.log('[showBreakdownPreview] 用户修改意见:', feedback);
        currentBreakdown.revisionHistory.push({ role: 'user', content: feedback });

        $('#breakdownChatInput').disabled = true;
        $('#breakdownChatSendBtn').disabled = true;
        $('#breakdownChatLoading').style.display = 'block';

        try {
          const newParsed = await callBreakdownAI(currentBreakdown.originalInput, feedback);
          currentBreakdown.revisionHistory.push({ role: 'assistant', content: '已根据你的意见重新整理方案，看看上面的预览～' });
          currentParsed = newParsed;
          console.log('[showBreakdownPreview] 重新拆解完成');
          renderModal();
        } catch (err) {
          console.error('[showBreakdownPreview] 重新拆解失败:', err);
          showToast(err.message, 'error');
          $('#breakdownChatInput').disabled = false;
          $('#breakdownChatSendBtn').disabled = false;
          $('#breakdownChatLoading').style.display = 'none';
        }
      };

      $('#breakdownChatSendBtn').onclick = sendRevision;
      $('#breakdownChatInput').onkeydown = (e) => { if (e.key === 'Enter') sendRevision(); };
    }
  };

  // 先把 modal 加到 DOM 中，再渲染（这样 $() 才能找到元素）
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // 初始渲染
  renderModal();
}

/**
 * 启动任务拆解流程（带用户确认和修改）
 * @param {string} taskInput - 用户输入的原始任务描述
 * @returns {Promise<void>} 无返回值
 */
async function breakDownTask(taskInput) {
  console.log('[breakDownTask] 开始拆解任务:', taskInput);
  const loadingId = showLoading('首席幕僚正在整理你的计划...');

  // 初始化会话状态
  currentBreakdown = {
    originalInput: taskInput,
    parsedResult: null,
    revisionHistory: [],
  };

  try {
    const parsed = await callBreakdownAI(taskInput);
    hideLoading(loadingId);
    showBreakdownPreview(parsed);
  } catch (err) {
    hideLoading(loadingId);
    showToast(err.message, 'error');
    console.error('[breakDownTask] 任务拆解失败:', err);
    // 拆解失败时通知新手引导优雅退出，避免引导一直等待预览弹窗出现
    document.dispatchEvent(new CustomEvent('tour:taskFailed', { detail: { message: err.message } }));
  }
}

// ===== 渲染：下一个待办 =====

/**
 * 渲染主界面的"下一个待办"卡片
 * 从所有 pending 任务中选择时间最近的一个（或第一个）显示
 */
function renderNextTask() {
  const data = getData();
  const pending = data.tasks.filter(t => t.status === 'pending');
  console.log('[renderNextTask] 找到待办任务:', pending.length, '个');
  const container = $('#nextTaskContainer');
  const quickInput = $('#quickTaskInput');

  if (pending.length === 0) {
    console.log('[renderNextTask] 暂无待办，显示空状态');
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;text-align:center;">
        <div class="emoji" style="font-size:48px;margin-bottom:16px;">🌱</div>
        <p style="color:var(--muted);font-size:14px;line-height:1.7;">
          今天还没有安排任务<br>
          在上方输入框告诉我你想做什么，<br>
          我来帮你拆成"没理由不做"的小步骤
        </p>
      </div>`;
    return;
  }

  // 找下一个待办：有 scheduledTime 且最近的，或者第一个 pending
  const now = new Date();
  let nextTask = null;
  let minDiff = Infinity;

  pending.forEach(t => {
    if (t.scheduledTime) {
      const tTime = parseScheduledDateTime(t.scheduledDate, t.scheduledTime);
      if (tTime) {
        const diff = tTime - now;
        if (diff > -30 * 60 * 1000 && diff < minDiff) { // 30分钟内的也算
          minDiff = diff;
          nextTask = t;
        }
      }
    }
  });

  if (!nextTask) nextTask = pending[0];
  console.log('[renderNextTask] 选中的下一个任务:', nextTask.text, '时间:', nextTask.scheduledTime || '未安排');

  const timeLabel = formatScheduledDisplay(nextTask.scheduledDate, nextTask.scheduledTime);
  const parentLabel = nextTask.parentTask ? `<span style="font-size:11px;color:var(--muted);background:var(--bg2);padding:2px 8px;border-radius:100px;">${escapeHtml(nextTask.parentTask)}</span>` : '';

  container.innerHTML = `
    <div class="next-task-card">
      <div class="next-task-header">
        ${parentLabel ? `<div style="flex:1;">${parentLabel}</div>` : '<div style="flex:1;"></div>'}
        <span style="font-size:12px;color:var(--accent3);">⏰ ${timeLabel}</span>
        <button class="action-btn ghost tiny" onclick="openTaskMenu(${nextTask.id})" title="修改/删除">⋮</button>
      </div>
      <div class="next-task-text">${escapeHtml(nextTask.text)}</div>
      <div class="next-task-meta">预计 ${nextTask.duration} 分钟</div>
      <div class="next-task-actions">
        <button class="action-btn primary" onclick="markDone(${nextTask.id})">我开始做了 ✓</button>
        <button class="action-btn secondary" onclick="markWait(${nextTask.id})">等一下...</button>
      </div>
    </div>
  `;

  // 语音播报（如果到时间了）
  if (nextTask.scheduledTime) {
    const tTime = parseScheduledDateTime(nextTask.scheduledDate, nextTask.scheduledTime);
    if (tTime && Math.abs(tTime - now) < 60 * 1000) {
      console.log('[renderNextTask] 任务到时间，触发语音播报');
      speakText(`到时间了，该做${nextTask.text}了`);
    }
  }
}

// ===== 辅助：将同事件下后续步骤一同顺延 =====
// taskId: 当前步骤ID；minutes: 顺延分钟数（正数后推，负数提前）
// 返回实际被顺延的步骤数

/**
 * 将同一母任务下、时间在指定步骤之后的所有待办步骤顺延
 * @param {number|string} taskId - 当前步骤的 ID
 * @param {number} minutes - 顺延分钟数（正数后推，负数提前）
 * @returns {number} 实际被顺延的步骤数量
 */
function shiftSiblingSteps(taskId, minutes, options = {}) {
  if (minutes === 0) return 0;
  taskId = Number(taskId);
  const autoSave = options.save !== false;
  const d = options.data || getData();
  const task = d.tasks.find(t => t.id === taskId);
  console.log('[shiftSiblingSteps] taskId:', taskId, 'minutes:', minutes, 'task:', task ? task.text : 'not found', 'parentTask:', task ? task.parentTask : 'none');
  if (!task || !task.parentTask) return 0;

  const taskTime = task.scheduledTime ? parseScheduledDateTime(task.scheduledDate, task.scheduledTime) : null;
  console.log('[shiftSiblingSteps] taskTime:', task.scheduledTime, '=>', taskTime);
  let count = 0;

  d.tasks.forEach(t => {
    // 同一事件 + 不是当前步骤 + 待办状态 + 有安排时间
    if (t.parentTask === task.parentTask && t.id !== taskId && t.status === 'pending' && t.scheduledTime) {
      const stepTime = parseScheduledDateTime(t.scheduledDate, t.scheduledTime);
      console.log('[shiftSiblingSteps] checking step:', t.text, 'time:', t.scheduledTime, 'stepTime >= taskTime:', taskTime ? (stepTime >= taskTime) : 'N/A(no taskTime)');
      if (stepTime) {
        // 如果当前步骤有时间，则只顺延时间 >= 当前步骤时间的步骤
        // 如果当前步骤没有时间，则顺延同事件下所有有时间的步骤
        if (!taskTime || stepTime >= taskTime) {
          stepTime.setMinutes(stepTime.getMinutes() + minutes);
          t.scheduledTime = formatTime(stepTime);
          t.scheduledDate = formatDate(stepTime);
          t.reminded = false;
          count++;
          console.log('[shiftSiblingSteps] shifted step:', t.text, 'to:', t.scheduledTime);
        }
      }
    }
  });

  console.log('[shiftSiblingSteps] total shifted:', count);
  if (count > 0 && autoSave) saveData(d);
  return count;
}

/**
 * 将所有排在锚点任务之后的待办任务顺延（跨事件联动）
 * @param {number|string} anchorTaskId - 锚点任务 ID（用于确定顺延的起始时间）
 * @param {number} minutes - 顺延分钟数（正数后推，负数提前）
 * @param {Object} [options] - 选项
 * @param {boolean} [options.useEndTime=true] - 是否以锚点任务的结束时间为基准（否则用开始时间）
 * @param {boolean} [options.save=true] - 是否自动保存数据
 * @returns {Object} { shiftedCount: 顺延的任务数, eventCount: 涉及的事件数 }
 */
function shiftAllSubsequentTasks(anchorTaskId, minutes, options = {}) {
  if (minutes === 0) return { shiftedCount: 0, eventCount: 0 };
  anchorTaskId = Number(anchorTaskId);
  const useEndTime = options.useEndTime !== false;
  const autoSave = options.save !== false;

  const d = options.data || getData();
  const anchorTask = d.tasks.find(t => t.id === anchorTaskId);
  if (!anchorTask || !anchorTask.scheduledTime) {
    console.warn('[shiftAllSubsequentTasks] 锚点任务不存在或无安排时间');
    return { shiftedCount: 0, eventCount: 0 };
  }

  // 计算锚点时间（结束时间或开始时间）
  let anchorTime = parseScheduledDateTime(anchorTask.scheduledDate, anchorTask.scheduledTime);
  if (!anchorTime) return { shiftedCount: 0, eventCount: 0 };
  if (useEndTime) {
    anchorTime = new Date(anchorTime.getTime() + anchorTask.duration * 60000);
  }
  const anchorTimeMs = anchorTime.getTime();

  let shiftedCount = 0;
  const affectedEvents = new Set();

  d.tasks.forEach(t => {
    // 跳过锚点任务本身、已完成任务、无安排时间的任务
    if (t.id === anchorTaskId || t.status !== 'pending' || !t.scheduledTime) return;

    const taskTime = parseScheduledDateTime(t.scheduledDate, t.scheduledTime);
    if (!taskTime) return;

    // 只顺延时间在锚点时间之后的任务
    if (taskTime.getTime() > anchorTimeMs) {
      taskTime.setMinutes(taskTime.getMinutes() + minutes);
      t.scheduledTime = formatTime(taskTime);
      t.scheduledDate = formatDate(taskTime);
      t.reminded = false;
      shiftedCount++;
      if (t.parentTask) affectedEvents.add(t.parentTask);
    }
  });

  console.log('[shiftAllSubsequentTasks] 顺延', shiftedCount, '个任务，涉及', affectedEvents.size, '个事件');
  if (shiftedCount > 0 && autoSave) saveData(d);
  return { shiftedCount, eventCount: affectedEvents.size };
}

// ===== 任务菜单（修改/删除）=====

/**
 * 打开单个步骤的修改/删除菜单弹窗
 * @param {number|string} taskId - 步骤 ID
 * @param {string} [source='main'] - 调用来源：'main' / 'pending' / 'done'
 */
function openTaskMenu(taskId, source) {
  taskId = Number(taskId); // 统一转为数字，避免字符串/数字类型不一致
  if (!source) source = 'main'; // 'main' 或 'pending' 或 'done'
  console.log('[openTaskMenu] 被调用, taskId:', taskId, 'source:', source);
  const data = getData();
  const task = data.tasks.find(t => t.id === taskId);
  console.log('[openTaskMenu] 找到 task:', task ? task.text : '没找到！');
  if (!task) {
    console.warn('[openTaskMenu] 任务不存在，taskId:', taskId);
    return;
  }

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show');
  overlay.style.zIndex = '3000';

  const isDone = source === 'done';
  const titleText = isDone ? '已完成事项' : '修改步骤';

  // 获取该任务的情绪对话历史（用于条件渲染"陪伴回顾/清空对话"按钮）
  const emotionHistory = getEmotionHistoryByTaskId(taskId);
  const hasEmotionHistory = emotionHistory && emotionHistory.sessions && emotionHistory.sessions.length > 0;
  const emotionSessionCount = hasEmotionHistory ? emotionHistory.sessions.length : 0;
  const emotionHistoryBtnsHtml = hasEmotionHistory ? `
    <div style="border-top:1px dashed var(--rule);padding-top:12px;margin-bottom:12px;display:flex;gap:8px;">
      <button class="action-btn" style="flex:1;background:var(--bg2);color:var(--accent2);border:1px solid var(--rule);font-size:12.5px;" id="reviewEmotionBtn">💬 陪伴回顾（${emotionSessionCount}）</button>
      <button class="action-btn" style="flex:0 0 auto;background:var(--bg2);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);font-size:12.5px;" id="clearEmotionBtn">清空对话</button>
    </div>
  ` : '';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '400px';

  // 根据是否已完成，渲染不同的内容
  let bodyHtml = '';
  if (isDone) {
    // 已完成：只显示信息和删除按钮
    bodyHtml = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">${titleText}</h3>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;text-decoration:line-through;opacity:0.7;">${escapeHtml(task.text)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">
        ${task.parentTask ? '属于：' + escapeHtml(task.parentTask) : ''}
        ${task.duration ? ' · ' + task.duration + '分钟' : ''}
        ${task.scheduledTime ? ' · ' + task.scheduledTime : ''}
      </div>
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">已完成的事项只能删除或重新加入待办哦～</p>
    ${emotionHistoryBtnsHtml}
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="action-btn" style="width:100%;background:var(--accent3-soft);color:var(--accent3);border-color:var(--accent3);" id="reAddTaskBtn">重新加入待办清单 ↺</button>
      <button class="action-btn danger" style="width:100%;" id="deleteTaskBtn">删除此事项</button>
    </div>
  `;
  } else {
    // 未完成：显示完整修改界面
    bodyHtml = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">${titleText}</h3>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;">${escapeHtml(task.text)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">
        ${task.parentTask ? '属于：' + escapeHtml(task.parentTask) : ''}
        ${task.duration ? ' · ' + task.duration + '分钟' : ''}
        ${task.scheduledTime ? ' · ' + task.scheduledTime : ''}
      </div>
    </div>

    <div style="margin-bottom:14px;">
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">步骤内容</label>
      <input type="text" id="editTaskText" class="api-input" style="margin-bottom:8px;" value="${escapeHtml(task.text)}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div>
        <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">时长(分钟)</label>
        <input type="number" id="editTaskDuration" class="api-input" style="margin-bottom:0;" value="${task.duration}" min="1">
      </div>
      <div>
        <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">时间(HH:MM)</label>
        <input type="text" id="editTaskTime" class="api-input" style="margin-bottom:0;" value="${task.scheduledTime || ''}" placeholder="14:30">
      </div>
    </div>

    <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="editShiftSubsequent" style="width:16px;height:16px;accent-color:var(--accent2);" checked>
      <label for="editShiftSubsequent" style="font-size:12px;color:var(--muted);cursor:pointer;">同步调整后续所有任务的时间</label>
    </div>

    ${emotionHistoryBtnsHtml}
    <div style="display:flex;gap:8px;">
      <button class="action-btn danger small" style="flex:0 0 auto;" id="deleteTaskBtn">删除</button>
      <button class="action-btn primary" style="flex:1;" id="saveEditBtn">保存修改</button>
    </div>
  `;
  }

  modal.innerHTML = bodyHtml;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // 保存修改（仅未完成状态）
  if (!isDone && $('#saveEditBtn')) {
    $('#saveEditBtn').onclick = () => {
    const newText = $('#editTaskText').value.trim();
    const newDuration = parseInt($('#editTaskDuration').value) || task.duration;
    const newTime = $('#editTaskTime').value.trim() || null;
    const shiftSubsequent = $('#editShiftSubsequent') ? $('#editShiftSubsequent').checked : false;
    console.log('[openTaskMenu] 保存修改，新内容:', newText, '时长:', newDuration, '时间:', newTime, '同步后续:', shiftSubsequent);
    if (!newText) { showToast('内容不能为空', 'error'); return; }

    // 计算时间变化量（使用支持日期的解析函数）
    let timeDiffMinutes = 0;
    if (task.scheduledTime && newTime) {
      const oldT = parseScheduledDateTime(task.scheduledDate, task.scheduledTime);
      const newT = parseScheduledDateTime(task.scheduledDate, newTime);
      if (oldT && newT) {
        timeDiffMinutes = Math.round((newT - oldT) / 60000);
      }
    } else if (!task.scheduledTime && newTime) {
      // 从无到有，暂时不顺延
    } else if (task.scheduledTime && !newTime) {
      // 从有到无，暂时不顺延
    }

    // 计算时长变化量（时长增加 → 后续步骤后推；时长减少 → 后续步骤提前）
    const oldDuration = task.duration || 0;
    const durationDiffMinutes = newDuration - oldDuration;

    // 总顺延时间 = 时间变化 + 时长变化
    const totalShiftMinutes = timeDiffMinutes + durationDiffMinutes;
    console.log('[openTaskMenu] 时间变化:', timeDiffMinutes, '分钟，时长变化:', durationDiffMinutes, '分钟，总顺延:', totalShiftMinutes, '分钟');

    const d = getData();
    const t = d.tasks.find(x => x.id === taskId);
    if (t) {
      t.text = newText;
      t.duration = newDuration;
      t.scheduledTime = newTime;
      t.reminded = false;
      console.log('[openTaskMenu] 任务已更新');

      // 如果时间或时长有变化
      let siblingShifted = 0;
      let crossEventResult = { shiftedCount: 0, eventCount: 0 };

      if (totalShiftMinutes !== 0) {
        // 先顺延同事件后续步骤（传入同一 data 对象，不单独保存）
        siblingShifted = shiftSiblingSteps(taskId, totalShiftMinutes, { data: d, save: false });
        console.log('[openTaskMenu] 已顺延同事件后续', siblingShifted, '步');

        // 跨事件联动（传入同一 data 对象，不单独保存）
        if (shiftSubsequent) {
          crossEventResult = shiftAllSubsequentTasks(taskId, totalShiftMinutes, { useEndTime: true, data: d, save: false });
        }
      }

      // 统一同步保存所有修改
      saveDataSync(d);
      scheduleReminders();

      // 生成提示消息
      let toastMsg = '已保存修改';
      const totalShifted = siblingShifted + crossEventResult.shiftedCount;
      if (totalShifted > 0) {
        const shiftDir = totalShiftMinutes > 0 ? '后推' : '提前';
        const shiftAbs = Math.abs(totalShiftMinutes);
        toastMsg = `已保存，后续 ${totalShifted} 步同步${shiftDir} ${shiftAbs} 分钟`;
        if (crossEventResult.eventCount > 0) {
          toastMsg += `（含 ${crossEventResult.eventCount} 个其他事件）`;
        }
      }
      showToast(toastMsg, 'success');

      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
        renderNextTask(); // 同步刷新主界面卡片
      } else {
        renderNextTask();
      }
      updateCounters();
    }
  };
  }

  // 重新加入待办清单（仅已完成状态）
  if (isDone && $('#reAddTaskBtn')) {
    $('#reAddTaskBtn').onclick = () => {
      console.log('[openTaskMenu] 用户请求重新加入待办:', task.text);
      const msg = '确定要将此事项重新加入待办清单吗？\n\n"' + task.text + '"';
      showConfirm(msg, function() {
        const stepCopy = [{
          text: task.text,
          duration: task.duration,
          scheduledTime: task.scheduledTime,
        }];
        overlay.remove();
        reAddStepsToPending(stepCopy, task.parentTask, source);
      });
    };
  }

  // 删除
  $('#deleteTaskBtn').onclick = function() {
    var msg = '确定要删除这个步骤吗？\n\n"' + task.text + '"\n\n删除后不可恢复。';
    console.log('[openTaskMenu] 用户请求删除任务:', task.text);
    showConfirm(msg, function() {
      // 用户点击"确定"
      try {
        console.log('[openTaskMenu] 用户确认删除，执行删除操作');
        var d = getData();
        d.tasks = d.tasks.filter(function(x) { return x.id !== taskId; });
        // 联动清理该任务的情绪对话历史
        if (Array.isArray(d.moods)) {
          d.moods = d.moods.filter(function(m) { return m.taskId !== taskId; });
        }
        saveDataSync(d);
        console.log('[openTaskMenu] 任务已删除，剩余任务数:', d.tasks.length);
        showToast('已删除', 'success');
        overlay.remove();
        if (source === 'pending' || source === 'done') {
          openListModal(source);
          renderNextTask(); // 同步刷新主界面卡片
        } else {
          renderNextTask();
        }
        updateCounters();
        scheduleReminders();
      } catch (e) {
        console.error('[openTaskMenu] 删除出错:', e);
        showToast('删除出错：' + e.message, 'error');
      }
    });
  };

  // 陪伴回顾 / 清空对话（仅当存在历史时渲染）
  if (hasEmotionHistory) {
    if ($('#reviewEmotionBtn')) {
      $('#reviewEmotionBtn').onclick = () => {
        console.log('[openTaskMenu] 用户查看陪伴回顾，taskId:', taskId);
        showEmotionHistoryModal(taskId);
      };
    }
    if ($('#clearEmotionBtn')) {
      $('#clearEmotionBtn').onclick = () => {
        console.log('[openTaskMenu] 用户请求清空对话，taskId:', taskId);
        showConfirm('确定要清空这个步骤的陪伴对话吗？\n\n共 ' + emotionSessionCount + ' 次对话将被删除，不可恢复。', function() {
          clearEmotionHistoryByTaskId(taskId);
          showToast('已清空对话记录', 'success');
          overlay.remove();
          // 重新打开菜单（此时按钮已消失）
          if (source === 'pending' || source === 'done') {
            openListModal(source);
          } else {
            renderNextTask();
          }
        });
      };
    }
  }
}

// ===== 辅助：把拆解结果扁平化 + 初始拆解保存前冲突检测 =====

/**
 * 把 AI 拆解结果扁平化为 findTimeConflicts 所需的 steps 数组
 * @param {Object} parsed - {tasks:[{parentTask, steps:[{text,duration,time}]}]}
 * @returns {Array<Object>} [{parentTask, text, duration, scheduledTime}]
 */
function flattenParsedSteps(parsed) {
  const steps = [];
  if (!parsed || !parsed.tasks) return steps;
  parsed.tasks.forEach(pt => {
    (pt.steps || []).forEach(s => {
      steps.push({
        parentTask: pt.parentTask,
        text: s.text,
        duration: s.duration || 10,
        scheduledTime: s.time || null,  // 字段名映射：time → scheduledTime
        scheduledDate: s.date || null,
      });
    });
  });
  return steps;
}

/**
 * 保存拆解结果，保存前检测与现有待办的时间冲突
 * 有冲突则复用 showConflictResolution 让用户处理；无冲突直接保存。
 * @param {Object} parsed - 拆解结果
 */
function saveBreakdownWithConflictCheck(parsed) {
  console.log('[saveBreakdownWithConflictCheck] 保存前检测冲突');
  const steps = flattenParsedSteps(parsed);
  const conflicts = findTimeConflicts(steps);

  if (conflicts.length > 0) {
    // 有冲突：复用 showConflictResolution 让用户处理
    const parentTaskName = (parsed.tasks || [])
      .map(t => t.parentTask)
      .filter(Boolean)
      .join('、') || '未分类';
    console.log('[saveBreakdownWithConflictCheck] 检测到', conflicts.length, '个冲突，弹出处理');
    showConflictResolution(conflicts, steps, parentTaskName);
    // 不在此 toast，由 showConflictResolution 处理完自行 toast
  } else {
    // 无冲突：直接保存
    const stepCount = saveBreakdownResult(parsed);
    showToast(`已整理为 ${stepCount} 个小步骤`, 'success');
  }
}

// ===== 辅助：检查步骤/事件与待办清单的时间冲突 =====
/**
 * 检查一组步骤与现有待办任务的时间冲突
 * @param {Array<Object>} steps - 要检查的步骤数组
 * @returns {Array<Object>} 冲突的待办任务数组
 */
function findTimeConflicts(steps) {
  const data = getData();
  const existing = data.tasks.filter(t => t.status === 'pending' && t.scheduledTime);
  const conflicts = [];

  steps.forEach(newStep => {
    if (!newStep.scheduledTime) return;
    const newStart = parseScheduledDateTime(newStep.scheduledDate, newStep.scheduledTime);
    if (!newStart) return;
    const newEnd = new Date(newStart.getTime() + (newStep.duration || 10) * 60000);

    existing.forEach(p => {
      const pStart = parseScheduledDateTime(p.scheduledDate, p.scheduledTime);
      if (!pStart) return;
      const pEnd = new Date(pStart.getTime() + (p.duration || 10) * 60000);
      if (newStart < pEnd && newEnd > pStart) {
        conflicts.push({
          newStep,
          existingTask: p,
          newStart,
          newEnd,
          existingStart: pStart,
          existingEnd: pEnd,
        });
      }
    });
  });

  return conflicts;
}

/**
 * 显示时间冲突处理弹窗
 * @param {Array<Object>} conflicts - 冲突的任务列表
 * @param {Array<Object>} stepsToAdd - 要加入的步骤
 * @param {string} parentTaskName - 母任务名称
 */
function showConflictResolution(conflicts, stepsToAdd, parentTaskName) {
  console.log('[showConflictResolution] 显示时间冲突处理弹窗，冲突数:', conflicts.length);

  let conflictHtml = '';
  conflicts.forEach(c => {
    const et = c.existingTask || c.newStep || {};
    conflictHtml += `<div style="padding:6px 10px;background:var(--bg2);border-radius:8px;margin-bottom:6px;font-size:12px;">
      ⏰ ${et.scheduledTime || '未定'} · ${escapeHtml(et.text || '')}${et.parentTask ? `（${escapeHtml(et.parentTask)}）` : ''}
    </div>`;
  });

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show');
  overlay.style.zIndex = '9998';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '460px';
  modal.innerHTML = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">时间有冲突哦～</h3>
    <p style="font-size:12.5px;margin-bottom:10px;">在以下时间已经安排了事项：</p>
    <div style="margin-bottom:14px;">${conflictHtml}</div>
    <p style="font-size:12.5px;color:var(--muted);margin-bottom:8px;">这两件事你想如何安排呢？可以在下方输入框告诉我！</p>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="conflictChatInput" class="api-input" style="flex:1;" placeholder="比如：把新任务改到明天下午，或者把旧任务往后推...">
      <button class="action-btn primary" id="conflictChatSendBtn" style="flex:0 0 auto;">帮我安排</button>
    </div>
    <div id="conflictChatLoading" style="display:none;text-align:center;padding:12px;color:var(--muted);font-size:12px;">
      <span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent-soft);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span>
      正在帮你重新安排...
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      showToast('已取消，本次未保存', 'info');
    }
  };

  const handleResolution = async () => {
    const userInput = $('#conflictChatInput').value.trim();
    if (!userInput) return;

    console.log('[showConflictResolution] 用户处理意见:', userInput);
    $('#conflictChatInput').disabled = true;
    $('#conflictChatSendBtn').disabled = true;
    $('#conflictChatLoading').style.display = 'block';

    try {
      const settings = getSettings();
      const stepsDesc = stepsToAdd.map((s, i) => `${i + 1}. ${s.text}${s.scheduledTime ? '（原时间' + s.scheduledTime + '）' : ''}${s.duration ? '（' + s.duration + '分钟）' : ''}`).join('\n');
      const conflictsDesc = conflicts.map(c => {
        const et = c.existingTask || c.newStep || {};
        return `- ${et.text || ''}（${et.scheduledTime || '未定'}，${et.duration || 10}分钟）`;
      }).join('\n');

      const prompt = `用户想把以下任务重新加入待办清单：
【要加入的任务】
事件：${parentTaskName || '未分类'}
步骤：
${stepsDesc}

【与以下待办任务有时间冲突】：
${conflictsDesc}

【用户的处理意见】："${userInput}"

请根据用户意见重新安排所有涉及的任务（包括要加入的和冲突的），返回 JSON 格式：
{
  "tasks": [
    {
      "parentTask": "事件名",
      "steps": [
        { "text": "步骤内容", "duration": 分钟数, "time": "HH:MM 或 null" }
      ]
    }
  ]
}
注意：要加入的新任务和冲突的旧任务都需要在返回结果中重新安排时间。只返回 JSON。`;

      const result = await SF_API.callAI(
        [{ role: 'user', content: prompt }],
        '你是任务调度助手。只返回 JSON。'
      );

      let parsed;
      try {
        const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.warn('[showConflictResolution] AI 返回解析失败:', result);
        showToast('AI 返回格式有误，请重试', 'error');
        $('#conflictChatInput').disabled = false;
        $('#conflictChatSendBtn').disabled = false;
        $('#conflictChatLoading').style.display = 'none';
        return;
      }

      // 删除冲突的旧任务（同步保存，确保后续 saveBreakdownResult 读到已删除的数据）
      const d = getData();
      const conflictIds = conflicts.map(c => (c.existingTask && c.existingTask.id) || c.id).filter(Boolean);
      d.tasks = d.tasks.filter(t => !conflictIds.includes(t.id));
      saveDataSync(d);

      // 保存 AI 重新安排的结果
      saveBreakdownResult(parsed);

      overlay.remove();
      showToast('已帮你重新安排好啦～', 'success');

    } catch (err) {
      console.error('[showConflictResolution] 处理失败:', err);
      showToast(err.message, 'error');
      $('#conflictChatInput').disabled = false;
      $('#conflictChatSendBtn').disabled = false;
      $('#conflictChatLoading').style.display = 'none';
    }
  };

  $('#conflictChatSendBtn').onclick = handleResolution;
  $('#conflictChatInput').onkeydown = (e) => { if (e.key === 'Enter') handleResolution(); };
}

/**
 * 将步骤重新加入待办清单（检查冲突）
 * @param {Array<Object>} steps - 要加入的步骤数组
 * @param {string} parentTaskName - 母任务名称
 */
function reAddStepsToPending(steps, parentTaskName, source) {
  console.log('[reAddStepsToPending] 重新加入待办，步骤数:', steps.length, '事件:', parentTaskName, '来源:', source);

  const conflicts = findTimeConflicts(steps);

  if (conflicts.length > 0) {
    // 有冲突：弹窗让用户处理
    showConflictResolution(conflicts, steps, parentTaskName);
  } else {
    // 无冲突：直接加入
    const d = getData();
    const now = Date.now();
    steps.forEach((step, idx) => {
      d.tasks.push({
        id: now + idx,
        parentTask: parentTaskName || step.parentTask || '未分类',
        text: step.text,
        duration: step.duration || 10,
        scheduledTime: step.scheduledTime || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        reminded: false,
      });
    });
    saveDataSync(d);
    renderNextTask();
    updateCounters();
    scheduleReminders();
    showToast(`已重新加入 ${steps.length} 个步骤到待办`, 'success');
    // 如果是从已完成清单触发的，刷新已完成清单
    if (source === 'done') {
      openListModal('done');
    }
  }
}

// ===== 事件分类菜单（整体修改/删除/提前完成）=====

/**
 * 打开整个母任务（事件分类）的操作菜单，支持整体时间偏移、删除、提前完成
 * @param {string} parentName - 母任务名称
 * @param {string} source - 调用来源：'main' / 'pending' / 'done'
 */
function openParentTaskMenu(parentName, source) {
  console.log('[openParentTaskMenu] 被调用, parentName:', parentName, 'source:', source);
  const data = getData();
  const steps = data.tasks.filter(t => t.parentTask === parentName);
  console.log('[openParentTaskMenu] 找到步骤数:', steps.length);
  if (steps.length === 0) {
    console.warn('[openParentTaskMenu] 没有找到属于该母任务的步骤');
    return;
  }

  const pendingCount = steps.filter(s => s.status === 'pending').length;
  const doneCount = steps.filter(s => s.status === 'done').length;
  const isDone = source === 'done';
  const titleText = isDone ? '已完成的事件' : '修改整件事';

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show');
  overlay.style.zIndex = '3000';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '420px';

  // 根据是否已完成，渲染不同的内容
  let parentBodyHtml = '';
  if (isDone) {
    // 已完成：只显示信息和删除按钮
    parentBodyHtml = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">${titleText}</h3>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;">${escapeHtml(parentName)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">
        共 ${steps.length} 步 · 已完成 ${doneCount}
      </div>
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">已完成的事件只能删除或重新加入待办哦～</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="action-btn" style="width:100%;background:var(--accent3-soft);color:var(--accent3);border-color:var(--accent3);" id="reAddParentBtn">重新加入待办清单 ↺</button>
      <button class="action-btn danger" style="width:100%;" id="deleteParentBtn">删除此事件</button>
    </div>
  `;
  } else {
    // 未完成：显示完整修改界面
    // 找到第一个有时间的步骤，作为默认日期和参考时间
    const firstScheduledStep = steps.find(s => s.scheduledTime && s.status === 'pending');
    const defaultDate = firstScheduledStep && firstScheduledStep.scheduledDate
      ? firstScheduledStep.scheduledDate
      : formatDate(new Date());
    const firstStepTime = firstScheduledStep && firstScheduledStep.scheduledTime
      ? firstScheduledStep.scheduledTime
      : '';
    const firstStepDisplay = firstScheduledStep
      ? `${formatScheduledDisplay(firstScheduledStep.scheduledDate, firstScheduledStep.scheduledTime)}`
      : '暂无安排时间';

    parentBodyHtml = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">${titleText}</h3>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;">${escapeHtml(parentName)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">
        共 ${steps.length} 步 · 待办 ${pendingCount} · 已完成 ${doneCount}
      </div>
      <div style="font-size:11px;color:var(--accent);margin-top:6px;padding-top:6px;border-top:1px solid var(--rule);">
        🕐 第一步：${escapeHtml(firstScheduledStep ? firstScheduledStep.text : '—')} · ${firstStepDisplay}
      </div>
    </div>

    <div style="margin-bottom:8px;font-size:12px;color:var(--muted);">
      📅 修改事件日期：
    </div>
    <div style="margin-bottom:16px;">
      <input type="date" id="shiftTargetDate" class="api-input" style="margin-bottom:0;" value="${defaultDate}">
    </div>

    <div style="margin-bottom:8px;font-size:12px;color:var(--muted);">
      ⏰ 同一天内的时间微调（正数=后推，负数=提前）：
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
      <div>
        <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">小时</label>
        <input type="number" id="shiftHours" class="api-input" style="margin-bottom:0;" value="0" placeholder="0">
      </div>
      <div>
        <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">分钟</label>
        <input type="number" id="shiftMinutes" class="api-input" style="margin-bottom:0;" value="0" placeholder="0">
      </div>
    </div>

    <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="shiftSubsequentTasks" style="width:16px;height:16px;accent-color:var(--accent2);" checked>
      <label for="shiftSubsequentTasks" style="font-size:12px;color:var(--muted);cursor:pointer;">同步调整后续所有任务的时间</label>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="action-btn primary" style="width:100%;" id="saveParentShiftBtn">保存修改</button>
      <button class="action-btn danger" style="width:100%;" id="deleteParentBtn">删除整件事</button>
      <button class="action-btn" style="width:100%;background:var(--accent3-soft);color:var(--accent3);border-color:var(--accent3);" id="finishParentBtn">提前完成了！(叉腰)</button>
    </div>
  `;
  }

  modal.innerHTML = parentBodyHtml;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // 保存修改（日期+时间偏移，仅未完成状态）
  if (!isDone && $('#saveParentShiftBtn')) {
    $('#saveParentShiftBtn').onclick = () => {
    const targetDate = $('#shiftTargetDate') ? $('#shiftTargetDate').value : null;
    const hours = parseInt($('#shiftHours').value) || 0;
    const minutes = parseInt($('#shiftMinutes').value) || 0;
    const timeShiftMinutes = hours * 60 + minutes;
    const shiftSubsequent = $('#shiftSubsequentTasks') ? $('#shiftSubsequentTasks').checked : false;

    console.log('[openParentTaskMenu] 保存修改，目标日期:', targetDate, '时间偏移:', timeShiftMinutes, '分钟, 同步后续:', shiftSubsequent);

    // 找到第一个有时间的待办步骤（作为日期变更的参考）
    const firstPendingStep = steps.find(s => s.scheduledTime && s.status === 'pending');
    if (!firstPendingStep || !firstPendingStep.scheduledTime) {
      showToast('该事件没有安排时间的步骤', 'info');
      return;
    }

    const originalDate = firstPendingStep.scheduledDate || formatDate(new Date());
    const dateChanged = targetDate && targetDate !== originalDate;
    const timeChanged = timeShiftMinutes !== 0;

    if (!dateChanged && !timeChanged) {
      showToast('没有变化哦～', 'info');
      return;
    }

    // 计算日期偏移天数
    let dayDiff = 0;
    if (dateChanged) {
      const orig = new Date(originalDate);
      const targ = new Date(targetDate);
      dayDiff = Math.round((targ - orig) / (1000 * 60 * 60 * 24));
    }

    // 生成确认消息
    let changeDesc = '';
    if (dateChanged) {
      changeDesc += `改到 ${targetDate}`;
    }
    if (timeChanged) {
      const direction = timeShiftMinutes > 0 ? '后推' : '提前';
      const absHours = Math.abs(hours);
      const absMins = Math.abs(minutes);
      let timeStr = '';
      if (absHours > 0) timeStr += absHours + '小时';
      if (absMins > 0) timeStr += absMins + '分钟';
      if (dateChanged) changeDesc += '，并';
      changeDesc += `${direction} ${timeStr}`;
    }
    if (shiftSubsequent) {
      changeDesc += '，同步调整后续任务';
    }

    const msg = `确定要将 "${parentName}" ${changeDesc}吗？`;
    const stepIds = steps.map(s => s.id);

    showConfirm(msg, function() {
      console.log('[openParentTaskMenu] 用户确认，开始执行修改');
      const d = getData();
      let modifiedCount = 0;
      let lastModifiedStepId = null;

      // 先修改本事件内的所有待办步骤
      stepIds.forEach(sid => {
        const t = d.tasks.find(x => x.id === sid);
        if (t && t.status === 'pending' && t.scheduledTime) {
          let tTime = parseScheduledDateTime(t.scheduledDate, t.scheduledTime);
          if (tTime) {
            // 日期偏移
            if (dayDiff !== 0) {
              tTime.setDate(tTime.getDate() + dayDiff);
            }
            // 时间偏移
            if (timeShiftMinutes !== 0) {
              tTime.setMinutes(tTime.getMinutes() + timeShiftMinutes);
            }
            t.scheduledTime = formatTime(tTime);
            t.scheduledDate = formatDate(tTime);
            t.reminded = false;
            modifiedCount++;
            lastModifiedStepId = t.id;
          }
        }
      });

      console.log('[openParentTaskMenu] 本事件修改完成，修改了', modifiedCount, '个步骤');

      // 跨事件联动：顺延后续所有任务（传入同一 data 对象，不单独保存）
      let crossEventResult = { shiftedCount: 0, eventCount: 0 };
      if (shiftSubsequent && lastModifiedStepId && (dayDiff !== 0 || timeShiftMinutes !== 0)) {
        const totalShift = dayDiff * 24 * 60 + timeShiftMinutes;
        crossEventResult = shiftAllSubsequentTasks(lastModifiedStepId, totalShift, { useEndTime: true, data: d, save: false });
      }

      // 统一同步保存所有修改
      saveDataSync(d);
      scheduleReminders();

      // 生成提示消息
      let toastMsg = `已${dateChanged ? '修改日期' : ''}${dateChanged && timeChanged ? '并' : ''}${timeChanged ? (timeShiftMinutes > 0 ? '后推' : '提前') + '时间' : ''}`;
      if (crossEventResult.shiftedCount > 0) {
        toastMsg += `，后续 ${crossEventResult.shiftedCount} 步同步调整（含 ${crossEventResult.eventCount} 个事件）`;
      }
      showToast(toastMsg, 'success');

      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
        renderNextTask(); // 同步刷新主界面卡片
      } else {
        renderNextTask();
      }
      updateCounters();
    });
  };
  }

  // 重新加入待办清单（仅已完成状态，整个事件）
  if (isDone && $('#reAddParentBtn')) {
    $('#reAddParentBtn').onclick = () => {
      console.log('[openParentTaskMenu] 用户请求重新加入待办（整个事件:', parentName);
      const msg = '确定要将此事件的所有步骤重新加入待办清单吗？\n\n"' + parentName + '"（共' + steps.length + '步）';
      showConfirm(msg, function() {
        // 复制所有步骤数据
        const stepsCopy = steps.map(s => ({
          text: s.text,
          duration: s.duration,
          scheduledTime: s.scheduledTime,
        }));
        overlay.remove();
        reAddStepsToPending(stepsCopy, parentName, source);
      });
    };
  }

  // 删除整件事
  $('#deleteParentBtn').onclick = () => {
    const msg = `确定要删除整件事 "${parentName}" 吗？\n\n这将删除所有 ${steps.length} 个步骤，且不可恢复。`;
    console.log('[openParentTaskMenu] 用户请求删除整件事:', parentName);
    showConfirm(msg, function() {
      console.log('[openParentTaskMenu] 用户确认删除整件事');
      const d = getData();
      d.tasks = d.tasks.filter(t => t.parentTask !== parentName);
      saveDataSync(d);
      console.log('[openParentTaskMenu] 整件事已删除，剩余任务数:', d.tasks.length);
      showToast('已删除整件事', 'success');
      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
        renderNextTask(); // 同步刷新主界面卡片
      } else {
        renderNextTask();
      }
      updateCounters();
      scheduleReminders();
    });
  };

  // 提前完成整件事（仅未完成状态）
  if (!isDone && $('#finishParentBtn')) {
    $('#finishParentBtn').onclick = () => {
    const msg = `确定整件事 "${parentName}" 已经全部完成了吗？\n\n这将把所有 ${pendingCount} 个待办步骤标记为已完成。`;
    console.log('[openParentTaskMenu] 用户请求提前完成整件事:', parentName, '待办数:', pendingCount);
    showConfirm(msg, function() {
      console.log('[openParentTaskMenu] 用户确认提前完成整件事');
      const d = getData();
      const now = new Date().toISOString();
      let completedCount = 0;
      const _batchIds = [];
      d.tasks.forEach(t => {
        if (t.parentTask === parentName && t.status === 'pending') {
          t.status = 'done';
          t.completedAt = now;
          const _bid = Date.now() + Math.random();
          _batchIds.push(_bid);
          d.diary = [...(d.diary || []), { id: _bid, type: 'achievement', text: '完成了：' + t.text, timestamp: now }];
          completedCount++;
        }
      });
      saveDataSync(d);
      console.log('[openParentTaskMenu] 整件事完成，标记了', completedCount, '个步骤');
      playSmallCelebration();
      playNotificationSound();

      // 幼教语气夸奖
      var settings = getSettings();
      var praisePrompt = '用户刚刚完成了整件事："' + parentName + '"（共' + steps.length + '个步骤）。请用温柔、软萌、真诚的语气夸奖用户，像一个很会夸人的好朋友。要求：1. 多用"你"字，少提"我"；2. 具体提到完成的这件事，不要空泛；3. 2-3句话；4. 以"你真的好棒！"开头。';

      var praiseModal3 = showPraiseStream();
      try {
        SF_API.callAIStream(
          [{ role: 'user', content: praisePrompt }],
          '你是一个温柔软萌、很会夸人的陪伴者。语气真诚温暖，多用"你"，少提"我"。'
        ).then(function(fullText) {
          if (fullText) {
            praiseModal3.update(fullText);
            // 将夸夸内容写回本批次所有日记条目
            const d2 = getData();
            _batchIds.forEach(bid => {
              const entry = d2.diary.find(e => e.id === bid);
              if (entry) entry.aiResponse = fullText;
            });
            saveData(d2);
          }
        }).catch(function(err) {
          const fallback = '你真的好棒！完成了"' + parentName + '"的全部' + steps.length + '个步骤，你太厉害了～✨';
          praiseModal3.update(fallback);
          const d2 = getData();
          _batchIds.forEach(bid => {
            const entry = d2.diary.find(e => e.id === bid);
            if (entry) entry.aiResponse = fallback;
          });
          saveData(d2);
        });
      } catch (e) {
        praiseModal3.update('你真的好棒！完成了"' + parentName + '"的全部' + steps.length + '个步骤，你太厉害了～✨');
      }

      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
        renderNextTask(); // 同步刷新主界面卡片
      } else {
        renderNextTask();
      }
      updateCounters();
      scheduleReminders();
    });
  };
  }
}

// ===== 标记完成 =====

/**
 * 将指定任务标记为已完成，触发烟花庆祝、AI夸奖、日记记录和通知音效
 * @param {number|string} taskId - 任务 ID
 * @returns {Promise<void>} 无返回值
 */
async function markDone(taskId) {
  taskId = Number(taskId);
  console.log('[markDone] 标记任务完成，taskId:', taskId);
  const data = getData();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) {
    console.warn('[markDone] 任务不存在，taskId:', taskId);
    return;
  }
  console.log('[markDone] 完成任务:', task.text);

  task.status = 'done';
  task.completedAt = new Date().toISOString();
  const _diaryId = Date.now();
  data.diary = [...(data.diary || []), { id: _diaryId, type: 'achievement', date: todayDateStr(), text: `完成了：${task.parentTask ? task.parentTask + ' · ' : ''}${task.text}`, timestamp: new Date().toISOString() }];
  saveDataSync(data);

  // 行为画像埋点
  try {
    let delayMinutes = 0;
    if (task.scheduledTime) {
      const scheduled = parseScheduledDateTime(task.scheduledDate, task.scheduledTime);
      if (scheduled) delayMinutes = Math.max(0, Math.round((Date.now() - scheduled.getTime()) / 60000));
    }
    window.SF_PROFILE.trackTaskCompleted(task, delayMinutes);
  } catch (e) { console.warn('[markDone] 画像埋点失败:', e); }

  renderNextTask();
  updateCounters();

  // 小庆祝烟花
  playSmallCelebration();
  playNotificationSound();

  // 幼教语气夸奖（30秒自动消失）
  const settings = getSettings();
  const praisePrompt = '用户刚刚完成了："' + task.text + '"。请用温柔、软萌、真诚的语气夸奖用户，像一个很会夸人的好朋友。要求：1. 多用"你"字，少提"我"；2. 具体提到完成的这件事，不要空泛；3. 2-3句话；4. 以"你真的好棒！"开头。';

  var praiseModal = showPraiseStream();
  try {
    SF_API.callAIStream(
      [{ role: 'user', content: praisePrompt }],
      '你是一个温柔软萌、很会夸人的陪伴者。语气真诚温暖，多用"你"，少提"我"。'
    ).then(function(fullText) {
      if (fullText) {
        praiseModal.update(fullText);
        // 将夸夸内容写回日记条目
        const d2 = getData();
        const entry = d2.diary.find(e => e.id === _diaryId);
        if (entry) { entry.aiResponse = fullText; saveData(d2); }
      }
      // 30秒后自动关闭
      setTimeout(function() { praiseModal.close(); }, 30000);
    }).catch(function(err) {
      const fallback = '你真的好棒！完成了"' + task.text + '"，你太厉害了～✨';
      praiseModal.update(fallback);
      const d2 = getData();
      const entry = d2.diary.find(e => e.id === _diaryId);
      if (entry) { entry.aiResponse = fallback; saveData(d2); }
      setTimeout(function() { praiseModal.close(); }, 30000);
    });
  } catch (e) {
    praiseModal.update('你真的好棒！完成了"' + task.text + '"，你太厉害了～✨');
    setTimeout(function() { praiseModal.close(); }, 30000);
  }

  console.log('[markDone] 已写入日记记录');
  // 触发引导事件：用户完成了任务
  document.dispatchEvent(new CustomEvent('tour:taskCompleted'));
}

// ===== 夸奖弹窗（默认点击关闭，可选自动消失）=====

/**
 * 显示夸奖弹窗
 * @param {string} message - 夸奖内容文字
 * @param {number} [autoCloseSeconds=0] - 自动关闭的秒数，0=不自动关闭
 */
function showPraise(message, autoCloseSeconds) {
  if (!autoCloseSeconds) autoCloseSeconds = 0;
  console.log('[showPraise] 显示夸奖弹窗，autoCloseSeconds:', autoCloseSeconds);
  var overlay = document.createElement('div');
  overlay.className = 'praise-overlay';
  overlay.dataset.created = Date.now().toString();
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;display:flex;align-items:center;justify-content:center;';

  var card = document.createElement('div');
  card.style.cssText = 'background:linear-gradient(135deg, #fff9e6 0%, #ffe4ec 100%);padding:32px 28px;border-radius:20px;max-width:360px;margin:20px;text-align:center;box-shadow:0 10px 40px rgba(255,150,180,0.3);border:2px solid #ffd6e0;';

  var hintText = autoCloseSeconds > 0
    ? `<div style="margin-top:18px;font-size:11px;color:#c9a0b0;opacity:0.8;">${autoCloseSeconds}秒后自动关闭 · 点击任意处关闭本次弹窗</div>`
    : `<div style="margin-top:18px;font-size:11px;color:#c9a0b0;opacity:0.8;">点击任意处关闭本次弹窗</div>`;

  card.innerHTML = `
    <div style="font-size:48px;margin-bottom:12px;">🌟</div>
    <div style="font-size:15px;line-height:1.9;color:#5a3d4a;white-space:pre-wrap;font-weight:500;">${escapeHtml(message)}</div>
    ${hintText}
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  var close = function() {
    overlay.remove();
  };

  overlay.onclick = close;
  card.onclick = function(e) { e.stopPropagation(); close(); };

  // 自动关闭
  if (autoCloseSeconds > 0) {
    setTimeout(close, autoCloseSeconds * 1000);
  }
}

/**
 * 流式版夸奖弹窗——立即创建弹窗，文字逐步显示
 * @param {Function} onClose - 弹窗关闭后的回调（可选）
 * @returns {Object} { update, close } 控制对象
 */
function showPraiseStream(onClose) {
  console.log('[showPraiseStream] 创建流式夸奖弹窗');
  var overlay = document.createElement('div');
  overlay.className = 'praise-overlay';
  overlay.dataset.created = Date.now().toString();
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;display:flex;align-items:center;justify-content:center;';

  var card = document.createElement('div');
  card.style.cssText = 'background:linear-gradient(135deg, #fff9e6 0%, #ffe4ec 100%);padding:32px 28px;border-radius:20px;max-width:360px;margin:20px;text-align:center;box-shadow:0 10px 40px rgba(255,150,180,0.3);border:2px solid #ffd6e0;';

  var contentDiv = document.createElement('div');
  contentDiv.style.cssText = 'font-size:15px;line-height:1.9;color:#5a3d4a;white-space:pre-wrap;font-weight:500;min-height:40px;';
  contentDiv.innerHTML = `<div style="display:flex;align-items:center;gap:8px;justify-content:center;opacity:0.8;">${getMascotSmallHTML('正在准备对你说…')}</div>`;

  var hintDiv = document.createElement('div');
  hintDiv.style.cssText = 'margin-top:18px;font-size:11px;color:#c9a0b0;opacity:0.8;display:none;';
  hintDiv.textContent = '点击任意处关闭本次弹窗';

  card.appendChild(contentDiv);
  card.appendChild(hintDiv);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  var closed = false;
  var close = function() {
    if (closed) return;
    closed = true;
    overlay.remove();
    if (onClose) onClose();
  };

  overlay.onclick = null;
  card.onclick = null;

  var hintShown = false;
  return {
    update: function(fullText) {
      if (closed) return;
      contentDiv.innerHTML = md(fullText);
      if (!hintShown) {
        hintShown = true;
        hintDiv.style.display = 'block';
        overlay.onclick = close;
        card.onclick = function(e) { e.stopPropagation(); close(); };
      }
    },
    close: close,
    isClosed: function() { return closed; }
  };
}

// ===== 从清单标记完成（带确认+幼教夸奖+小庆祝）=====

/**
 * 从待办清单中标记任务完成（带确认弹窗、AI夸奖、小庆祝动画）
 * @param {number|string} taskId - 任务 ID
 */
function markDoneFromList(taskId) {
  taskId = Number(taskId); // 统一转为数字
  console.log('[markDoneFromList] 从清单标记完成，taskId:', taskId);
  var data = getData();
  var task = data.tasks.find(function(t) { return t.id === taskId; });
  if (!task) {
    console.warn('[markDoneFromList] 任务不存在，taskId:', taskId);
    return;
  }

  var msg = '确定已经完成这个步骤了吗？\n\n"' + task.text + '"\n\n完成后我会好好夸夸你～';
  showConfirm(msg, function() {
    console.log('[markDoneFromList] 用户确认完成');
    // 标记完成
    var d2 = getData();
    var t2 = d2.tasks.find(function(x) { return x.id === taskId; });
    if (!t2) return;
    t2.status = 'done';
    t2.completedAt = new Date().toISOString();
    const _diaryId2 = Date.now();
    d2.diary = [...(d2.diary || []), { id: _diaryId2, type: 'achievement', date: todayDateStr(), text: '完成了：' + (t2.parentTask ? t2.parentTask + ' · ' : '') + t2.text, timestamp: new Date().toISOString() }];
    saveDataSync(d2);

    // 行为画像埋点
    try {
      let delayMinutes = 0;
      if (t2.scheduledTime) {
        const scheduled = parseScheduledDateTime(t2.scheduledDate, t2.scheduledTime);
        if (scheduled) delayMinutes = Math.max(0, Math.round((Date.now() - scheduled.getTime()) / 60000));
      }
      window.SF_PROFILE.trackTaskCompleted(t2, delayMinutes);
    } catch (e) { console.warn('[markDoneFromList] 画像埋点失败:', e); }

    console.log('[markDoneFromList] 任务已标记完成，开始 AI 夸奖');

    // 小庆祝
    playSmallCelebration();
    playNotificationSound();

    // 幼教语气夸奖 - 不要自称老师，多用"你"，少提"我"
    var settings = getSettings();
    var userName = settings.userName || '宝贝';
    var praisePrompt = '用户刚刚完成了："' + t2.text + '"。请用温柔、软萌、真诚的语气夸奖用户，像一个很会夸人的好朋友。要求：1. 多用"你"字，少提"我"；2. 具体提到完成的这件事，不要空泛；3. 2-3句话；4. 以"你真的好棒！"开头。';

    var praiseModal2 = showPraiseStream();
    try {
      SF_API.callAIStream(
        [{ role: 'user', content: praisePrompt }],
        '你是一个温柔软萌、很会夸人的陪伴者。语气真诚温暖，多用"你"，少提"我"。'
      ).then(function(fullText) {
        if (fullText) {
          praiseModal2.update(fullText);
          const d3 = getData();
          const entry = d3.diary.find(e => e.id === _diaryId2);
          if (entry) { entry.aiResponse = fullText; saveData(d3); }
        }
      }).catch(function(err) {
        const fallback = '你真的好棒！完成了"' + t2.text + '"，你太厉害了～✨';
        praiseModal2.update(fallback);
        const d3 = getData();
        const entry = d3.diary.find(e => e.id === _diaryId2);
        if (entry) { entry.aiResponse = fallback; saveData(d3); }
      });
    } catch (e) {
      praiseModal2.update('你真的好棒！完成了"' + t2.text + '"，你太厉害了～✨');
    }

    // 刷新清单
    openListModal('pending');
    renderNextTask(); // 同步刷新主界面卡片
    updateCounters();
  });
}

// ===== 标记 Wait =====
let currentEmotionState = 'select_reason';
let emotionConversationHistory = [];
let currentWaitTaskId = null;

/**
 * 用户点击"等一下"时触发，初始化情绪陪伴流程并打开情绪模态框
 * @param {number|string} taskId - 当前任务 ID
 */
function markWait(taskId) {
  taskId = Number(taskId);
  console.log('[markWait] 用户选择等一下，taskId:', taskId);
  currentWaitTaskId = taskId;
  currentEmotionState = 'select_reason';
  emotionConversationHistory = [];
  openEmotionModal(taskId);
  // 触发引导事件：用户对任务执行了操作（暂停）
  document.dispatchEvent(new CustomEvent('tour:taskCompleted'));
}

/**
 * 打开情绪陪伴模态框，显示任务信息和初始问候
 * @param {number|string} taskId - 当前任务 ID
 */
function openEmotionModal(taskId) {
  taskId = Number(taskId);
  console.log('[openEmotionModal] 打开情绪模态框，taskId:', taskId);
  const data = getData();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) {
    console.warn('[openEmotionModal] 任务不存在，taskId:', taskId);
    return;
  }

  $('#modalTaskName').textContent = task.text;
  $('#modalParentTask').textContent = task.parentTask || '';
  const container = $('#emotionChatArea');
  container.innerHTML = '';

  const settings = getSettings();
  const greeting = settings.userName
    ? `${settings.userName}，不急～ 能说说是什么让你现在不太想开始吗？`
    : `好的，不急～ 能说说是什么让你现在不太想开始吗？`;

  const aiBubble = createEl('div', 'chat-bubble ai');
  aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(greeting)}`;
  container.appendChild(aiBubble);
  showReasonSelector(container);

  $('#emotionModal').classList.add('show');
}

// ===== 情绪对话历史持久化（复用 data.moods 字段）=====

/**
 * 按 taskId 查找情绪对话历史记录
 * @param {number|string} taskId - 步骤 ID
 * @returns {Object|null} 该任务的对话历史记录，或 null
 */
function getEmotionHistoryByTaskId(taskId) {
  taskId = Number(taskId);
  const data = getData();
  if (!Array.isArray(data.moods)) return null;
  return data.moods.find(m => m.taskId === taskId) || null;
}

/**
 * 把本次情绪对话作为一个 session 追加到 moods
 * @param {number|string} taskId - 步骤 ID
 * @param {string} parentTask - 母任务名称（冗余存储）
 * @param {string} taskText - 步骤文本（冗余存储）
 * @param {Array<Object>} messages - 对话消息 [{role, content}]
 */
function appendEmotionSession(taskId, parentTask, taskText, messages) {
  taskId = Number(taskId);
  const data = getData();
  if (!Array.isArray(data.moods)) data.moods = [];

  const now = new Date().toISOString();
  const session = {
    startedAt: now,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      ts: Date.now(),
    })),
  };

  let record = data.moods.find(m => m.taskId === taskId);
  if (record) {
    record.sessions.push(session);
    record.updatedAt = now;
    // 更新冗余字段（任务文本可能被修改过）
    record.parentTask = parentTask || record.parentTask;
    record.taskText = taskText || record.taskText;
  } else {
    data.moods.push({
      taskId: taskId,
      parentTask: parentTask || '',
      taskText: taskText || '',
      sessions: [session],
      updatedAt: now,
    });
  }

  saveData(data);
  console.log('[appendEmotionSession] 已保存对话历史，taskId:', taskId, '会话数:', record ? record.sessions.length : 1);
}

/**
 * 清空指定任务的全部情绪对话历史
 * @param {number|string} taskId - 步骤 ID
 */
function clearEmotionHistoryByTaskId(taskId) {
  taskId = Number(taskId);
  const data = getData();
  if (!Array.isArray(data.moods)) return;
  const before = data.moods.length;
  data.moods = data.moods.filter(m => m.taskId !== taskId);
  saveData(data);
  console.log('[clearEmotionHistoryByTaskId] 已清空，taskId:', taskId, '删除记录数:', before - data.moods.length);
}

/**
 * 将单个任务的情绪对话历史格式化为文本
 * @param {Object} history - 情绪历史记录对象
 * @returns {string} 格式化后的文本
 */
function formatEmotionHistoryForCopy(history) {
  if (!history || !history.sessions || history.sessions.length === 0) return '';
  let text = '';
  if (history.parentTask) {
    text += `【事件】${history.parentTask}\n`;
  }
  text += `【步骤】${history.taskText}\n\n`;
  history.sessions.forEach((session, idx) => {
    const sessionDate = new Date(session.startedAt);
    const timeLabel = sessionDate.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    text += `===== 第 ${idx + 1} 次陪伴 · ${timeLabel} =====\n\n`;
    (session.messages || []).forEach(m => {
      const speaker = m.role === 'user' ? '我' : 'StepForward';
      text += `${speaker}：${m.content}\n\n`;
    });
  });
  return text.trim();
}

/**
 * 复制单个任务的情绪对话历史到剪贴板
 * @param {number|string} taskId - 步骤 ID
 */
async function copyEmotionHistory(taskId) {
  taskId = Number(taskId);
  const history = getEmotionHistoryByTaskId(taskId);
  if (!history || !history.sessions || history.sessions.length === 0) {
    showToast('暂无对话记录', 'info');
    return;
  }
  const text = formatEmotionHistoryForCopy(history);
  const success = await copyToClipboard(text);
  if (success) {
    showToast(`已复制 ${history.sessions.length} 次对话记录`, 'success');
  } else {
    showToast('复制失败，请手动选择文本复制', 'error');
  }
}

/**
 * 将所有情绪陪伴对话历史格式化为文本（按事件-步骤分类）
 * @returns {string} 格式化后的文本
 */
function formatAllEmotionHistoryForCopy() {
  const data = getData();
  if (!Array.isArray(data.moods) || data.moods.length === 0) return '';

  // 按 parentTask 分组
  const groups = {};
  data.moods.forEach(m => {
    const key = m.parentTask || '未分类';
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  let text = '';
  const groupKeys = Object.keys(groups);
  groupKeys.forEach((groupName, gIdx) => {
    text += `===== 事件：${groupName} =====\n\n`;
    groups[groupName].forEach((history, hIdx) => {
      text += `--- 步骤：${history.taskText} ---\n\n`;
      history.sessions.forEach((session, sIdx) => {
        const sessionDate = new Date(session.startedAt);
        const timeLabel = sessionDate.toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        text += `【第 ${sIdx + 1} 次陪伴 · ${timeLabel}】\n`;
        (session.messages || []).forEach(m => {
          const speaker = m.role === 'user' ? '我' : 'StepForward';
          text += `${speaker}：${m.content}\n`;
        });
        text += '\n';
      });
      if (hIdx < groups[groupName].length - 1) text += '\n';
    });
    if (gIdx < groupKeys.length - 1) text += '\n';
  });

  return text.trim();
}

/**
 * 一键复制所有陪伴回顾到剪贴板
 */
async function exportAllEmotionHistory() {
  const data = getData();
  if (!Array.isArray(data.moods) || data.moods.length === 0) {
    showToast('暂无陪伴记录', 'info');
    return;
  }
  const text = formatAllEmotionHistoryForCopy();
  const totalSessions = data.moods.reduce((sum, m) => sum + (m.sessions ? m.sessions.length : 0), 0);
  const success = await copyToClipboard(text);
  if (success) {
    showToast(`已复制 ${data.moods.length} 个步骤的 ${totalSessions} 次陪伴记录`, 'success');
  } else {
    showToast('复制失败，请手动选择文本复制', 'error');
  }
}

/**
 * 将所有成长日记格式化为文本（按日期分组）
 * @returns {string} 格式化后的文本
 */
function formatAllDiaryForCopy() {
  const diary = getSortedDiary();
  if (diary.length === 0) return '';

  // 按日期分组（getSortedDiary 已是日期倒序）
  const groups = {};
  diary.forEach(d => {
    const key = d.date || '未知日期';
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  let text = '';
  const dates = Object.keys(groups);
  dates.forEach((dateStr, dIdx) => {
    const dateLabel = formatDateLabel(dateStr);
    text += `===== ${dateStr}（${dateLabel}）=====\n\n`;

    groups[dateStr].forEach((entry, eIdx) => {
      const timeStr = entry.timestamp ? formatTime(new Date(entry.timestamp)) : '';
      const meta = DIARY_TYPE_META[entry.type] || DIARY_TYPE_META.manual;

      if (entry.type === 'achievement') {
        text += `${meta.icon} ${meta.label} · ${timeStr}\n`;
        text += `${entry.text || ''}\n`;
        if (entry.aiResponse) {
          text += `--- 夸夸 ---\n${entry.aiResponse}\n`;
        }

      } else if (entry.type === 'manual') {
        const moodTag = entry.mood ? ` · ${entry.mood}` : '';
        text += `${meta.icon} ${meta.label}${moodTag} · ${timeStr}\n`;
        text += `--- 我的日记 ---\n${entry.text || ''}\n`;
        if (entry.aiResponse) {
          text += `--- AI 的回应 ---\n${entry.aiResponse}\n`;
        }

      } else if (entry.type === 'bedtime') {
        text += `${meta.icon} ${meta.label} · ${timeStr}\n`;
        if (entry.review && entry.review.length > 0) {
          text += `--- 今日回顾 ---\n`;
          entry.review.forEach((r, i) => { text += `${i + 1}. ${r}\n`; });
        }
        if (entry.gratitudes && entry.gratitudes.length > 0) {
          text += `--- 小确幸 ---\n`;
          entry.gratitudes.forEach((g, i) => { text += `${i + 1}. ${g}\n`; });
        }
        if (entry.anxietySaved && entry.anxietyText) {
          text += `--- 放下的焦虑 ---\n${entry.anxietyText}\n`;
        }
        if (entry.goodnightMessage) {
          text += `--- 晚安语 ---\n${entry.goodnightMessage}\n`;
        }
      }

      if (eIdx < groups[dateStr].length - 1) text += '\n';
    });

    if (dIdx < dates.length - 1) text += '\n\n';
  });

  return text.trim();
}

/**
 * 一键复制所有成长日记到剪贴板
 */
async function exportAllDiaryHistory() {
  const diary = getSortedDiary();
  if (diary.length === 0) {
    showToast('暂无日记记录', 'info');
    return;
  }
  const text = formatAllDiaryForCopy();
  const success = await copyToClipboard(text);
  if (success) {
    showToast(`已复制 ${diary.length} 条日记记录`, 'success');
  } else {
    showToast('复制失败，请手动选择文本复制', 'error');
  }
}

/**
 * 显示陪伴回顾弹窗（只读，按时间倒序展示每次会话）
 * @param {number|string} taskId - 步骤 ID
 */
function showEmotionHistoryModal(taskId) {
  taskId = Number(taskId);
  const history = getEmotionHistoryByTaskId(taskId);
  if (!history || !history.sessions || history.sessions.length === 0) {
    showToast('暂无对话记录', 'info');
    return;
  }
  console.log('[showEmotionHistoryModal] 显示回顾，taskId:', taskId, '会话数:', history.sessions.length);

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show');
  overlay.style.zIndex = '4000';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '460px';
  modal.innerHTML = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="color:var(--accent2);margin:0;">💬 陪伴回顾</h3>
      <button class="copy-btn" id="copyHistoryBtn">📋 复制对话</button>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
      ${history.parentTask ? '<span style="display:inline-block;background:var(--bg2);padding:2px 8px;border-radius:100px;margin-right:6px;">' + escapeHtml(history.parentTask) + '</span>' : ''}
      ${escapeHtml(history.taskText)}
    </div>
    <div id="historyChatArea" class="chat-area" style="max-height:55vh;overflow-y:auto;"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // 绑定复制按钮
  const copyBtn = $('#copyHistoryBtn');
  if (copyBtn) {
    copyBtn.onclick = function() {
      copyEmotionHistory(taskId);
    };
  }

  const area = $('#historyChatArea');
  const totalSessions = history.sessions.length;
  // 按时间倒序展示（最新的一次在最上面）
  [...history.sessions].reverse().forEach((session, idx) => {
    const order = totalSessions - idx; // 正序编号：第 N 次
    const sessionDate = new Date(session.startedAt);
    const timeLabel = sessionDate.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    const divider = createEl('div');
    divider.style.cssText = 'font-size:11px;color:var(--muted);text-align:center;margin:10px 0 6px;';
    divider.textContent = `—— 第 ${order} 次陪伴 · ${timeLabel} ——`;
    area.appendChild(divider);

    (session.messages || []).forEach(m => {
      const bubble = createEl('div', 'chat-bubble ' + (m.role === 'user' ? 'user' : 'ai'));
      bubble.innerHTML = `<span class="speaker">${m.role === 'user' ? '我' : 'StepForward'}</span>${md(m.content)}`;
      area.appendChild(bubble);
    });
  });

  // 滚动到顶部（最新的在上方）
  area.scrollTop = 0;
}

/**
 * 关闭情绪陪伴模态框（关闭前自动持久化本次对话）
 */
function closeEmotionModal() {
  console.log('[closeEmotionModal] 关闭情绪模态框');
  // 持久化本次对话历史
  if (emotionConversationHistory.length > 0 && currentWaitTaskId) {
    const data = getData();
    const task = data.tasks.find(t => t.id === Number(currentWaitTaskId));
    if (task) {
      appendEmotionSession(task.id, task.parentTask, task.text, emotionConversationHistory);
    } else {
      console.log('[closeEmotionModal] 任务已不存在，跳过持久化');
    }
  }
  $('#emotionModal').classList.remove('show');
}

/**
 * 关闭待办/已完成清单模态框
 */
function closeListModal() {
  console.log('[closeListModal] 关闭清单模态框');
  $('#listModal').classList.remove('show');
  // 重置批量模式
  window._listBatchMode = false;
  if (window._batchSelectedIds) window._batchSelectedIds.clear();
}

// ===== 危机安全边界 =====

/**
 * 危机关键词列表
 */
const CRISIS_KEYWORDS = [
  '不想活了', '想死', '自杀', '结束生命', '一了百了', '活着没意思',
  '死了算了', '想消失', '去死', '跳楼', '割腕', '自伤', '自残',
  '伤害自己', '不想存在', '了结', '解脱', '离开这个世界', '活着干什么',
  '没有意义', '想结束', '不想面对'
];

/**
 * 检测用户输入是否包含危机信号
 * @param {string} text - 用户输入文本
 * @returns {boolean} 是否检测到危机信号
 */
function detectCrisisSignal(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  for (const keyword of CRISIS_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      console.log('[detectCrisisSignal] 检测到危机关键词:', keyword);
      return true;
    }
  }
  return false;
}

/**
 * 显示危机回应（硬编码模板，确保100%触发，不走AI）
 * @param {string} userText - 用户的输入文本
 */
function showCrisisResponse(userText) {
  console.log('[showCrisisResponse] 触发危机回应，用户输入:', userText);
  const container = $('#emotionChatArea');

  // 显示用户消息
  const userBubble = createEl('div', 'chat-bubble user');
  userBubble.innerHTML = `<span class="speaker">我</span>${escapeHtml(userText)}`;
  container.appendChild(userBubble);

  // 移除之前的选项按钮
  container.querySelectorAll('.mood-selector').forEach(el => el.remove());

  // 插入援助信息卡片
  const crisisCard = createEl('div', 'crisis-card');
  crisisCard.style.cssText = 'background:#fff5f5;border:2px solid #e88;border-radius:14px;padding:16px;margin:12px 0;text-align:center;';
  crisisCard.innerHTML = `
    <div style="font-size:14px;font-weight:700;color:#c44;margin-bottom:10px;">💛 你不是一个人</div>
    <div style="font-size:12.5px;color:#844;line-height:1.8;margin-bottom:12px;">
      如果你现在有伤害自己的想法，请立即拨打以下电话，和真人说说话——他们 24 小时都在：
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <a href="tel:4001619995" style="display:block;padding:10px;background:#fff;border-radius:10px;text-decoration:none;color:#c44;font-weight:600;font-size:13px;border:1px solid #fcc;">
        📞 全国24小时心理援助热线<br><span style="font-size:15px;">400-161-9995</span>
      </a>
      <a href="tel:01082951332" style="display:block;padding:10px;background:#fff;border-radius:10px;text-decoration:none;color:#c44;font-weight:600;font-size:13px;border:1px solid #fcc;">
        📞 北京心理危机研究与干预中心<br><span style="font-size:15px;">010-82951332</span>
      </a>
      <a href="tel:4008211215" style="display:block;padding:10px;background:#fff;border-radius:10px;text-decoration:none;color:#c44;font-weight:600;font-size:13px;border:1px solid #fcc;">
        📞 生命热线<br><span style="font-size:15px;">400-821-1215</span>
      </a>
    </div>
  `;
  container.appendChild(crisisCard);

  // 显示 AI 危机回应（使用模板，同时调用AI做温暖陪伴）
  const aiBubble = createEl('div', 'chat-bubble ai');
  aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(window.SF_PROMPT.CRISIS_RESPONSE_TEMPLATE)}`;
  container.appendChild(aiBubble);

  container.scrollTop = container.scrollHeight;

  // 同时调用AI做温暖陪伴回复（流式或非流式都行，这里用非流式保持简单）
  const settings = getSettings();
  try {
    SF_API.callAI(
      [{ role: 'user', content: '用户刚才表达了很痛苦的感受，可能涉及自我伤害。请用温暖、不评判的语气回应，让用户感觉到被陪伴。不要说教，不要恐慌，只是陪伴。简短回复，50字以内。' }],
      SF_PROMPT.buildSystemPrompt('emotional_supporter', settings)
    ).then(function(response) {
      // 在危机模板之后追加AI的温暖陪伴
      const followUpBubble = createEl('div', 'chat-bubble ai');
      followUpBubble.innerHTML = `<span class="speaker">StepForward</span>${md(response)}`;
      container.appendChild(followUpBubble);
      container.scrollTop = container.scrollHeight;
    }).catch(function(err) {
      console.warn('[showCrisisResponse] AI陪伴回复失败，仅显示模板:', err);
    });
  } catch (e) {
    console.warn('[showCrisisResponse] AI调用失败:', e);
  }
}

/**
 * 在情绪陪伴区域显示原因选择按钮
 * @param {Element} container - 聊天区域 DOM 容器
 */
function showReasonSelector(container) {
  console.log('[showReasonSelector] 显示原因选择器');
  const reasons = [
    { key: 'lazy', text: '就是没心情 / 懒得动', level: 1 },
    { key: 'overwhelm', text: '事情太多太乱了', level: 2 },
    { key: 'selfdoubt', text: '我很糟糕 / 自我否定', level: 3 },
    { key: 'interrupt', text: '有别的事插进来了', level: 4 },
    { key: 'tired', text: '累了，想歇会儿', level: 4 },
  ];

  const selector = createEl('div', 'mood-selector');
  selector.style.marginTop = '12px';
  reasons.forEach(r => {
    const btn = createEl('button', 'mood-btn', r.text);
    btn.onclick = () => handleMoodReason(r.key, r.text, r.level);
    selector.appendChild(btn);
  });
  container.appendChild(selector);
}

/**
 * 处理用户选择的情绪原因，显示用户选择并继续情绪干预
 * @param {string} reasonKey - 原因标识键
 * @param {string} reasonText - 原因描述文字
 * @param {number} level - 情绪等级（1-4）
 * @returns {Promise<void>} 无返回值
 */
async function handleMoodReason(reasonKey, reasonText, level) {
  console.log('[handleMoodReason] 用户选择原因:', reasonKey, '等级:', level, '描述:', reasonText);
  const container = $('#emotionChatArea');
  const userBubble = createEl('div', 'chat-bubble user');
  userBubble.innerHTML = `<span class="speaker">我</span>${md(reasonText)}`;
  container.appendChild(userBubble);

  const sel = container.querySelector('.mood-selector');
  if (sel) sel.remove();

  await continueEmotionIntervention(reasonText, level);
}

/**
 * 调用 AI 进行情绪干预，根据等级显示后续操作选项
 * @param {string} reasonText - 用户表达的原因/感受
 * @param {number} level - 情绪等级（1-4）
 * @returns {Promise<void>} 无返回值
 */
async function continueEmotionIntervention(reasonText, level) {
  console.log('[continueEmotionIntervention] 开始情绪干预，原因:', reasonText, '等级:', level);
  
  // 危机检测：前端关键词预筛
  if (detectCrisisSignal(reasonText)) {
    showCrisisResponse(reasonText);
    return;
  }
  
  emotionConversationHistory.push({ role: 'user', content: reasonText });

  // 行为画像埋点：记录情绪事件
  try { window.SF_PROFILE.trackEmotionEvent(level, reasonText); } catch (e) {}

  const container = $('#emotionChatArea');
  const settings = getSettings();
  const loadingBubble = showLoadingBubble(container);

  try {
    console.log('[continueEmotionIntervention] 调用 AI 生成情绪支持回复...');
    const historyStr = emotionConversationHistory.map(h => `${h.role === 'user' ? '用户' : '你'}: ${h.content}`).join('\n');
    const userName = settings.userName || '';

    const prompt = SF_PROMPT.buildEmotionInterventionPrompt(reasonText, level, historyStr);

    // 创建 AI 气泡（先显示加载状态）
    const aiBubble = createEl('div', 'chat-bubble ai');
    aiBubble.innerHTML = `<span class="speaker">StepForward</span><span style="opacity:0.5;">正在思考…</span>`;
    container.appendChild(aiBubble);
    loadingBubble.remove();

    let fullResponse = '';
    try {
      fullResponse = await SF_API.callAIStream(
        [{ role: 'user', content: prompt }],
        SF_PROMPT.buildSystemPrompt('emotional_supporter', settings),
        null,
        function(chunk) {
          aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(chunk)}`;
          container.scrollTop = container.scrollHeight;
        }
      );
    } catch (streamErr) {
      // 流式失败，降级为非流式
      console.warn('[continueEmotionIntervention] 流式失败，降级非流式:', streamErr);
      fullResponse = await SF_API.callAI(
        [{ role: 'user', content: prompt }],
        SF_PROMPT.buildSystemPrompt('emotional_supporter', settings)
      );
    }

    emotionConversationHistory.push({ role: 'assistant', content: fullResponse });
    console.log('[continueEmotionIntervention] AI 回复完成，长度:', fullResponse.length);
    aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(fullResponse)}`;

    if (level === 4) {
      console.log('[continueEmotionIntervention] 等级4，显示重新安排选项');
      showRescheduleOptions(container);
    } else {
      console.log('[continueEmotionIntervention] 显示跟进按钮');
      showFollowUpButtons(container, level);
    }

  } catch (err) {
    loadingBubble.remove();
    console.error('[continueEmotionIntervention] AI 情绪干预失败:', err);
    showToast(err.message, 'error');
  }

  container.scrollTop = container.scrollHeight;
}

/**
 * 显示情绪干预后的跟进按钮（好多了/还是很难受/先放下）
 * @param {Element} container - 聊天区域 DOM 容器
 * @param {number} level - 情绪等级（1-4）
 */
function showFollowUpButtons(container, level) {
  console.log('[showFollowUpButtons] 显示跟进按钮');
  const wrap = createEl('div', 'mood-selector');
  wrap.style.marginTop = '12px';

  const btn1 = createEl('button', 'mood-btn', '我好多了 ✨');
  btn1.style.cssText = 'background:var(--accent3-soft);color:var(--accent3);border-color:var(--accent3);';
  btn1.onclick = () => handleUserImproved();

  const btn2 = createEl('button', 'mood-btn', '我还是很难受');
  btn2.style.cssText = 'background:rgba(201,139,107,0.12);color:var(--accent);border-color:var(--accent);';
  btn2.onclick = () => handleUserStillBad(level);

  const btn3 = createEl('button', 'mood-btn', '先放下，晚点再说');
  btn3.onclick = () => showRescheduleOptions(container);

  wrap.appendChild(btn1); wrap.appendChild(btn2); wrap.appendChild(btn3);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

/**
 * 处理用户"我好多了"的反馈，给予鼓励并给出下一步选择
 */
function handleUserImproved() {
  console.log('[handleUserImproved] 用户表示好多了');
  const container = $('#emotionChatArea');
  const settings = getSettings();
  const name = settings.userName ? settings.userName : '';
  container.querySelectorAll('.mood-selector').forEach(el => el.remove());

  const aiBubble = createEl('div', 'chat-bubble ai');
  aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(
    `太好了。${name ? name + '，' : ''}你愿意面对这份感受，愿意尝试调整，这本身就已经很勇敢了 💗\n\n现在感觉怎么样？想试试开始做任务，还是再休息一会儿？`
  )}`;
  container.appendChild(aiBubble);

  const wrap = createEl('div', 'mood-selector');
  wrap.style.marginTop = '12px';
  const b1 = createEl('button', 'mood-btn', '我想试试开始做');
  b1.style.cssText = 'background:var(--accent3-soft);color:var(--accent3);';
  b1.onclick = () => { showToast('好的！我陪着你，就从最小的那一步开始', 'success'); setTimeout(closeEmotionModal, 1500); };
  const b2 = createEl('button', 'mood-btn', '再休息一会儿');
  b2.onclick = () => showRescheduleOptions(container);
  wrap.appendChild(b1); wrap.appendChild(b2);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

/**
 * 处理用户"我还是很难受"的反馈，进行更深一步的情绪支持
 * @param {number} level - 情绪等级（1-4）
 * @returns {Promise<void>} 无返回值
 */
async function handleUserStillBad(level) {
  console.log('[handleUserStillBad] 用户表示仍然难受，等级:', level);
  const container = $('#emotionChatArea');
  container.querySelectorAll('.mood-selector').forEach(el => el.remove());

  const userBubble = createEl('div', 'chat-bubble user');
  userBubble.innerHTML = `<span class="speaker">我</span>我还是很难受...`;
  container.appendChild(userBubble);
  emotionConversationHistory.push({ role: 'user', content: '我还是很难受，感觉没有好转' });

  const loadingBubble = showLoadingBubble(container);
  const settings = getSettings();

  try {
    console.log('[handleUserStillBad] 调用 AI 生成深度情绪支持...');
    const historyStr = emotionConversationHistory.map(h => `${h.role === 'user' ? '用户' : '你'}: ${h.content}`).join('\n');
    const deeperPrompt = `用户说还是很难受，没有好转。

之前的对话：
${historyStr}

请给出更深一步的支持：
- 换一种方法（如果之前用了着陆练习，现在试试自我慈悲；反之亦然）
- 语气更柔软，更有耐心
- 不急着让用户"好起来"，而是让用户感受到"我陪着你，难受也没关系"
- **短段落，留白**
- 用 **加粗** 标出关键词
- 100-200字`;

    const aiBubble = createEl('div', 'chat-bubble ai');
    aiBubble.innerHTML = `<span class="speaker">StepForward</span><span style="opacity:0.5;">正在思考…</span>`;
    container.appendChild(aiBubble);
    loadingBubble.remove();

    let response = '';
    try {
      response = await SF_API.callAIStream(
        [{ role: 'user', content: deeperPrompt }],
        SF_PROMPT.buildSystemPrompt('emotional_supporter', settings),
        null,
        function(chunk) {
          aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(chunk)}`;
          container.scrollTop = container.scrollHeight;
        }
      );
    } catch (streamErr) {
      console.warn('[handleUserStillBad] 流式失败，降级非流式:', streamErr);
      response = await SF_API.callAI(
        [{ role: 'user', content: deeperPrompt }],
        SF_PROMPT.buildSystemPrompt('emotional_supporter', settings)
      );
    }

    emotionConversationHistory.push({ role: 'assistant', content: response });
    aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(response)}`;

    const wrap = createEl('div', 'mood-selector');
    wrap.style.marginTop = '12px';
    const b1 = createEl('button', 'mood-btn', '我想继续聊聊');
    b1.onclick = () => { $('#emotionInput').focus(); container.scrollTop = container.scrollHeight; };

    const b2 = createEl('button', 'mood-btn', '先放下，休息一下');
    b2.onclick = () => showRescheduleOptions(container);
    wrap.appendChild(b1); wrap.appendChild(b2);
    container.appendChild(wrap);

  } catch (err) { loadingBubble.remove(); console.error('[handleUserStillBad] 深度情绪支持失败:', err); showToast(err.message, 'error'); }
  container.scrollTop = container.scrollHeight;
}

/**
 * 显示任务顺延时间选项按钮
 * @param {Element} container - 聊天区域 DOM 容器
 */
function showRescheduleOptions(container) {
  console.log('[showRescheduleOptions] 显示顺延时间选项');
  container.querySelectorAll('.mood-selector').forEach(el => el.remove());

  const wrap = createEl('div');
  wrap.innerHTML = `
    <p style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:10px;">想把这个任务往后顺延多久？</p>
    <div class="mood-selector">
      <button class="mood-btn" data-min="15">15 分钟</button>
      <button class="mood-btn" data-min="30">30 分钟</button>
      <button class="mood-btn" data-min="60">1 小时</button>
      <button class="mood-btn" data-min="120">2 小时</button>
      <button class="mood-btn" data-min="custom">自定义...</button>
    </div>
  `;
  container.appendChild(wrap);

  wrap.querySelectorAll('.mood-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.min;
      if (val === 'custom') showCustomTimeInput(container);
      else doReschedule(parseInt(val));
    };
  });
  container.scrollTop = container.scrollHeight;
}

/**
 * 显示自定义顺延时间输入框
 * @param {Element} container - 聊天区域 DOM 容器
 */
function showCustomTimeInput(container) {
  console.log('[showCustomTimeInput] 显示自定义时间输入');
  container.querySelectorAll('.mood-selector').forEach(el => el.remove());
  const wrap = createEl('div');
  wrap.innerHTML = `<div class="input-box" style="margin-top:8px;"><input type="number" id="customMinInput" placeholder="输入分钟数" min="1"><button class="send-btn" id="customMinBtn">确定</button></div>`;
  container.appendChild(wrap);
  $('#customMinBtn').onclick = () => { const mins = parseInt($('#customMinInput').value); if (mins > 0) doReschedule(mins); };
  $('#customMinInput').onkeydown = (e) => { if (e.key === 'Enter') $('#customMinBtn').click(); };
}

/**
 * 执行任务顺延操作，将当前任务和同事件后续步骤一并顺延
 * @param {number} minutes - 顺延的分钟数
 */
function doReschedule(minutes) {
  console.log('[doReschedule] 顺延任务，分钟数:', minutes, '当前任务ID:', currentWaitTaskId);
  const data = getData();
  const settings = getSettings();
  const task = data.tasks.find(t => t.id === currentWaitTaskId);

  if (task && task.scheduledTime) {
    const t = parseTimeStr(task.scheduledTime);
    if (t) { t.setMinutes(t.getMinutes() + minutes); task.scheduledTime = formatTime(t); task.reminded = false; }
    console.log('[doReschedule] 当前任务新时间:', task.scheduledTime);
  } else if (task) {
    console.log('[doReschedule] 当前任务无安排时间，不顺延自身');
  }

  // 顺延同事件的后续步骤（传入同一 data 对象，不单独保存）
  let shiftedCount = 0;
  if (task) {
    shiftedCount = shiftSiblingSteps(currentWaitTaskId, minutes, { data: data, save: false });
    console.log('[doReschedule] 同事件后续步骤顺延数:', shiftedCount);
  }

  // 统一同步保存所有修改
  saveDataSync(data);
  renderNextTask();
  scheduleReminders();
  updateCounters();
  if (shiftedCount > 0) {
    showToast(`已顺延 ${minutes} 分钟，后续 ${shiftedCount} 步已同步后推`, 'success');
  } else {
    showToast(`已顺延 ${minutes} 分钟`, 'success');
  }
  setTimeout(closeEmotionModal, 1500);
}

// ===== 到时间提醒 =====
let reminderTimers = [];

/**
 * 为所有待办且有安排时间的任务设置定时器，到时间时弹出提醒
 */
function scheduleReminders() {
  console.log('[scheduleReminders] 重新安排任务提醒');
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];
  const data = getData();
  const now = new Date();

  let scheduledCount = 0;
  data.tasks.forEach(task => {
    if (task.status !== 'pending' || task.reminded || !task.scheduledTime) return;
    const taskTime = parseScheduledDateTime(task.scheduledDate, task.scheduledTime);
    if (!taskTime) return;
    const diff = taskTime - now;
    // 过期任务(diff<0)不设0ms定时器，由 handleOverdueTasks 统一处理
    if (diff < 0) return;
    const delay = Math.max(0, diff);
    if (delay > 12 * 60 * 60 * 1000) return;

    const timer = setTimeout(() => {
      task.reminded = true;
      saveData(data);
      showTaskReminder(task);
    }, delay);
    reminderTimers.push(timer);
    scheduledCount++;
  });
  console.log('[scheduleReminders] 已安排', scheduledCount, '个提醒');
}

/**
 * 显示任务到时间的提醒弹窗
 * @param {Object} task - 任务对象
 */
function showTaskReminder(task) {
  console.log('[showTaskReminder] 显示任务提醒:', task.text);
  playNotificationSound();
  speakText(`到时间了，该做${task.text}了`);

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show'); overlay.style.zIndex = '2000';

  const modal = createEl('div', 'modal');
  modal.innerHTML = `
    <h3 style="color:var(--accent2);margin-top:0;">⏰ 到时间啦</h3>
    ${task.parentTask ? `<p style="font-size:12px;color:var(--muted);margin-bottom:6px;">属于：${escapeHtml(task.parentTask)}</p>` : ''}
    <p style="font-size:15px;margin-bottom:16px;">${escapeHtml(task.text)}</p>
    <p style="font-size:12px;color:var(--muted);margin-bottom:20px;">${task.duration ? `预计 ${task.duration} 分钟 · ` : ''}${task.scheduledTime || ''}</p>
    <div style="display:flex;gap:10px;">
      <button class="action-btn primary" style="flex:1;" id="reminderDone">我开始做了 ✓</button>
      <button class="action-btn secondary" style="flex:1;" id="reminderWait">等一下...</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.classList.add('show');

  $('#reminderDone').onclick = () => { overlay.remove(); markDone(task.id); };
  $('#reminderWait').onclick = () => { overlay.remove(); markWait(task.id); };
}

// ===== 清单弹窗 =====

/**
 * 根据当前筛选状态过滤任务
 * @param {Array} tasks - 原始任务数组
 * @returns {Array} 过滤后的任务数组
 */
function filterTasksByDate(tasks) {
  if (listFilterState.type === 'all') {
    return tasks;
  }
  if (listFilterState.type === 'today') {
    const today = todayDateStr();
    return tasks.filter(t => !t.scheduledDate || t.scheduledDate === today);
  }
  if (listFilterState.type === 'custom' && listFilterState.dateStart && listFilterState.dateEnd) {
    return tasks.filter(t => {
      if (!t.scheduledDate) return true; // 无日期的旧数据始终显示
      return t.scheduledDate >= listFilterState.dateStart && t.scheduledDate <= listFilterState.dateEnd;
    });
  }
  return tasks;
}

/**
 * 打开待办/已完成清单弹窗，按母任务分组显示
 * @param {string} type - 清单类型：'pending'（待办）或 'done'（已完成）
 */
function openListModal(type) {
  console.log('[openListModal] 打开清单，类型:', type);
  const data = getData();
  currentListType = type;
  let tasks = type === 'pending'
    ? data.tasks.filter(t => t.status === 'pending')
    : data.tasks.filter(t => t.status === 'done');
  // 日期筛选
  tasks = filterTasksByDate(tasks);
  console.log('[openListModal] 任务数:', tasks.length);

  const title = type === 'pending' ? '📋 待办清单' : '✅ 已完成清单';
  const emptyText = type === 'pending' ? '暂时没有待办任务～' : '还没有完成的任务，加油！';

  // 按 parentTask 分组
  const groups = {};
  tasks.forEach(t => {
    const key = t.parentTask || '未分类';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  console.log('[openListModal] 分组数:', Object.keys(groups).length);

  // 辅助：获取步骤的时间戳用于排序（无时间的排到最后）
  const getStepTime = (step) => {
    if (!step.scheduledTime) return Infinity;
    const t = parseScheduledDateTime(step.scheduledDate, step.scheduledTime);
    return t ? t.getTime() : Infinity;
  };

  // 内圈排序：每个事件内的步骤按开始时间从早到晚
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => getStepTime(a) - getStepTime(b));
  });

  // 外圈排序：事件分类按其中第一个步骤的开始时间从早到晚
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const timeA = getStepTime(a[1][0]);
    const timeB = getStepTime(b[1][0]);
    return timeA - timeB;
  });

  let html = '';
  const batchMode = window._listBatchMode === true && type === 'pending';
  const selectedSet = window._batchSelectedIds || new Set();

  if (tasks.length === 0) {
    html = `<p style="text-align:center;color:var(--muted);padding:20px;">${emptyText}</p>`;
  } else {
    sortedGroups.forEach(([parent, steps]) => {
      const parentEncoded = encodeURIComponent(parent);
      const allChecked = batchMode && steps.every(t => selectedSet.has(String(t.id)));
      html += `<div style="margin-bottom:16px;">
        <div class="parent-task-header" data-parent="${parentEncoded}" style="padding:8px 4px;${batchMode ? 'cursor:default;' : 'cursor:pointer;'}border-radius:8px;transition:background 0.2s;" ${batchMode ? '' : 'onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'transparent\'"'}>
          ${batchMode ? `<input type="checkbox" class="batch-group-cb" data-parent="${parentEncoded}" ${allChecked ? 'checked' : ''} style="width:14px;height:14px;margin-right:6px;vertical-align:middle;">` : ''}
          <span style="font-size:13px;font-weight:700;color:var(--accent);">${escapeHtml(parent)}</span>
          <span style="font-weight:400;opacity:0.7;font-size:11px;">(${steps.length}步)</span>
          ${batchMode ? '' : '<span style="font-size:10px;color:var(--muted);margin-left:6px;opacity:0.6;">点击修改 ›</span>'}
        </div>`;
      steps.forEach((t, idx) => {
        const isDone = t.status === 'done';
        const clickable = !isDone && type === 'pending' && !batchMode;
        const isSelected = batchMode && selectedSet.has(String(t.id));

        // 动态计算步骤时长：待办清单中显示与同事件内下一步骤开始时间的实际间隔
        // 最后一步或无法计算时回退到存储的时长
        let durationLabel = t.duration ? ` · ${t.duration}分钟` : '';
        if (type === 'pending' && t.scheduledTime) {
          const nextStep = steps[idx + 1];
          if (nextStep && nextStep.scheduledTime) {
            const curTime = parseScheduledDateTime(t.scheduledDate, t.scheduledTime);
            const nextTime = parseScheduledDateTime(nextStep.scheduledDate, nextStep.scheduledTime);
            if (curTime && nextTime) {
              const gapMinutes = Math.round((nextTime - curTime) / 60000);
              if (gapMinutes > 0) durationLabel = ` · ${gapMinutes}分钟`;
            }
          }
        }

        html += `
          <div style="padding:8px 12px;display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--rule);">
            ${batchMode ? `<input type="checkbox" class="batch-step-cb" data-task-id="${t.id}" ${isSelected ? 'checked' : ''} style="width:16px;height:16px;flex-shrink:0;cursor:pointer;">` : `<div class="step-checkbox" data-task-id="${t.id}" style="width:18px;height:18px;border-radius:5px;border:2px solid ${isDone ? 'var(--accent3)' : 'var(--accent)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;${isDone ? 'background:var(--accent3);color:#fff;' : ''}${clickable ? 'cursor:pointer;' : ''}" title="${clickable ? '点击标记为完成' : ''}">${isDone ? '✓' : ''}</div>`}
            <div style="flex:1;">
              <div style="font-size:12.5px;${isDone ? 'text-decoration:line-through;opacity:0.6;' : ''}">${escapeHtml(t.text)}</div>
              <div style="font-size:10.5px;color:var(--muted);margin-top:2px;">
                ${formatScheduledDisplay(t.scheduledDate, t.scheduledTime)}${durationLabel}
              </div>
            </div>
            ${batchMode ? '' : `<button class="menu-btn" style="width:28px;height:28px;border-radius:8px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;" data-task-id="${t.id}" title="修改/删除">⋮</button>`}
          </div>`;
      });
      html += `</div>`;
    });
  }

  $('#listModalTitle').textContent = title;
  $('#listModalContent').innerHTML = html;
  $('#listModal').classList.add('show');

  // 批量模式 UI 控制
  const batchBtn = $('#batchModeBtn');
  const filterBtnsEl = $('#listFilterBtns');
  const batchActionBar = $('#batchActionBar');
  if (batchBtn) {
    batchBtn.textContent = batchMode ? '退出批量处理' : '批量处理';
    batchBtn.style.display = type === 'pending' ? '' : 'none';
  }
  if (filterBtnsEl) {
    filterBtnsEl.style.display = batchMode ? 'none' : 'flex';
  }
  if (batchActionBar) {
    batchActionBar.style.display = batchMode ? 'block' : 'none';
  }
  if (batchMode) {
    const countEl = $('#batchSelectedCount');
    if (countEl) countEl.textContent = `已选 ${selectedSet.size} 项`;
    const selectAllCb = $('#batchSelectAll');
    if (selectAllCb) selectAllCb.checked = tasks.length > 0 && tasks.every(t => selectedSet.has(String(t.id)));
  }

  // 绑定清单中每个步骤的 ⋮ 按钮
  console.log('[openListModal] 开始绑定 ⋮ 按钮，数量:', document.querySelectorAll('#listModalContent .menu-btn').length);
  document.querySelectorAll('#listModalContent .menu-btn').forEach(function(btn, idx) {
    console.log('[openListModal] 绑定按钮', idx, 'taskId:', btn.getAttribute('data-task-id'));
    btn.onclick = function(e) {
      console.log('[openListModal] ⋮ 按钮被点击');
      e.stopPropagation();
      e.preventDefault();
      var tid = btn.getAttribute('data-task-id');
      console.log('[openListModal] taskId:', tid, 'type:', type);
      if (tid) {
        console.log('[openListModal] 准备调用 openTaskMenu...');
        openTaskMenu(tid, type);
      }
    };
  });

  // 绑定清单中每个步骤的 checkbox（标记完成）
  if (type === 'pending') {
    document.querySelectorAll('#listModalContent .step-checkbox').forEach(function(cb) {
      cb.onclick = function(e) {
        e.stopPropagation();
        var tid = cb.getAttribute('data-task-id');
        if (tid) markDoneFromList(tid);
      };
    });
  }

  // 绑定事件分类标题的点击（修改整个事件）
  document.querySelectorAll('#listModalContent .parent-task-header').forEach(function(header) {
    header.onclick = function(e) {
      e.stopPropagation();
      var parentEncoded = header.getAttribute('data-parent');
      var parentName = decodeURIComponent(parentEncoded);
      if (parentName) openParentTaskMenu(parentName, type);
    };
  });

  // 初始化筛选栏状态
  const filterBtns = document.querySelectorAll('#listFilterBar .filter-btn');
  filterBtns.forEach(btn => {
    btn.classList.remove('filter-btn-active');
    if (btn.getAttribute('data-filter') === listFilterState.type) {
      btn.classList.add('filter-btn-active');
    }
    btn.onclick = function() {
      const filterType = this.getAttribute('data-filter');
      listFilterState.type = filterType;
      // 显示/隐藏自定义日期选择器
      const datePicker = $('#customDatePicker');
      if (filterType === 'custom') {
        datePicker.style.display = 'flex';
      } else {
        datePicker.style.display = 'none';
        listFilterState.dateStart = null;
        listFilterState.dateEnd = null;
        openListModal(currentListType); // 重新渲染
      }
    };
  });

  // 自定义日期选择器
  const customDatePicker = $('#customDatePicker');
  if (listFilterState.type === 'custom') {
    customDatePicker.style.display = 'flex';
  } else {
    customDatePicker.style.display = 'none';
  }

  const applyBtn = $('#applyDateFilter');
  if (applyBtn) {
    applyBtn.onclick = function() {
      listFilterState.dateStart = $('#filterDateStart').value || null;
      listFilterState.dateEnd = $('#filterDateEnd').value || null;
      if (listFilterState.dateStart && listFilterState.dateEnd) {
        openListModal(currentListType); // 重新渲染
      } else {
        showToast('请选择开始和结束日期', 'error');
      }
    };
  }

  // ========== 批量处理模式 ==========
  if (type === 'pending') {
    // 初始化选中集合
    if (!window._batchSelectedIds) window._batchSelectedIds = new Set();

    // 批量处理按钮
    const batchBtn = $('#batchModeBtn');
    if (batchBtn) {
      batchBtn.onclick = function() {
        window._listBatchMode = !window._listBatchMode;
        if (!window._listBatchMode) {
          window._batchSelectedIds.clear();
        }
        openListModal(currentListType);
      };
    }

    // 步骤 checkbox 点击
    document.querySelectorAll('#listModalContent .batch-step-cb').forEach(function(cb) {
      cb.onclick = function(e) {
        e.stopPropagation();
        const tid = String(cb.getAttribute('data-task-id'));
        if (tid) {
          if (cb.checked) {
            window._batchSelectedIds.add(tid);
          } else {
            window._batchSelectedIds.delete(tid);
          }
          updateBatchUI(tasks);
        }
      };
    });

    // 事件组 checkbox 点击
    document.querySelectorAll('#listModalContent .batch-group-cb').forEach(function(cb) {
      cb.onclick = function(e) {
        e.stopPropagation();
        const parentEncoded = cb.getAttribute('data-parent');
        const parentName = decodeURIComponent(parentEncoded);
        // 找到该组所有任务
        const groupTasks = tasks.filter(t => (t.parentTask || '未分类') === parentName);
        if (cb.checked) {
          groupTasks.forEach(t => window._batchSelectedIds.add(String(t.id)));
        } else {
          groupTasks.forEach(t => window._batchSelectedIds.delete(String(t.id)));
        }
        updateBatchUI(tasks);
      };
    });

    // 全选 checkbox
    const selectAllCb = $('#batchSelectAll');
    if (selectAllCb) {
      selectAllCb.onclick = function() {
        if (selectAllCb.checked) {
          tasks.forEach(t => window._batchSelectedIds.add(String(t.id)));
        } else {
          window._batchSelectedIds.clear();
        }
        updateBatchUI(tasks);
      };
    }

    // 批量删除
    const batchDeleteBtn = $('#batchDeleteBtn');
    if (batchDeleteBtn) {
      batchDeleteBtn.onclick = function() {
        const count = window._batchSelectedIds.size;
        if (count === 0) { showToast('请先勾选任务', 'info'); return; }
        const d = getData();
        let removed = 0;
        window._batchSelectedIds.forEach(tid => {
          const idx = d.tasks.findIndex(x => String(x.id) === String(tid));
          if (idx > -1) {
            // 联动清理该任务的情绪对话历史
            if (Array.isArray(d.moods)) {
              d.moods = d.moods.filter(function(m) { return m.taskId !== d.tasks[idx].id; });
            }
            d.tasks.splice(idx, 1);
            removed++;
          }
        });
        saveDataSync(d);
        window._batchSelectedIds.clear();
        showToast(`已删除 ${removed} 个任务`, 'success');
        openListModal(currentListType);
        renderNextTask(); // 同步刷新主界面卡片
        updateCounters();
      };
    }

    // 批量标记已完成
    const batchDoneBtn = $('#batchDoneBtn');
    if (batchDoneBtn) {
      batchDoneBtn.onclick = function() {
        const count = window._batchSelectedIds.size;
        if (count === 0) { showToast('请先勾选任务', 'info'); return; }
        const d = getData();
        const now = new Date().toISOString();
        let doneCount = 0;
        window._batchSelectedIds.forEach(tid => {
          const task = d.tasks.find(x => String(x.id) === String(tid));
          if (task && task.status === 'pending') {
            task.status = 'done';
            task.completedAt = now;
            task.reminded = false;
            // 写入成就日记
            d.diary = [...(d.diary || []), {
              id: 'diary_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              type: 'achievement',
              date: todayDateStr(),
              text: '完成了：' + (task.parentTask ? task.parentTask + ' · ' : '') + task.text,
              timestamp: new Date().toISOString()
            }];
            doneCount++;
          }
        });
        saveDataSync(d);
        window._batchSelectedIds.clear();
        showToast(`${doneCount} 个任务已完成 ✨`, 'success');
        if (doneCount > 0) playSmallCelebration();
        openListModal(currentListType);
        renderNextTask(); // 同步刷新主界面卡片
        updateCounters();
      };
    }
  }

  // 更新批量模式 UI（不重渲染，只更新计数和全选状态）
  function updateBatchUI(allTasks) {
    const countEl = $('#batchSelectedCount');
    if (countEl) countEl.textContent = `已选 ${window._batchSelectedIds.size} 项`;
    const selectAllCb = $('#batchSelectAll');
    if (selectAllCb) {
      selectAllCb.checked = allTasks.length > 0 && allTasks.every(t => window._batchSelectedIds.has(String(t.id)));
    }
    // 同步更新每个 checkbox 的勾选状态
    document.querySelectorAll('#listModalContent .batch-step-cb').forEach(function(cb) {
      const tid = String(cb.getAttribute('data-task-id'));
      cb.checked = window._batchSelectedIds.has(tid);
    });
    // 同步更新每个组 checkbox
    document.querySelectorAll('#listModalContent .batch-group-cb').forEach(function(cb) {
      const parentEncoded = cb.getAttribute('data-parent');
      const parentName = decodeURIComponent(parentEncoded);
      const groupTasks = allTasks.filter(t => (t.parentTask || '未分类') === parentName);
      cb.checked = groupTasks.length > 0 && groupTasks.every(t => window._batchSelectedIds.has(String(t.id)));
    });
  }
}

// ===== 设置页面 =====

/**
 * 打开设置弹窗，填充当前设置值
 */
function openSettings() {
  console.log('[openSettings] 打开设置弹窗');
  const s = getSettings();
  $('#settingsUserName').value = s.userName || '';
  $('#settingsAutoReschedule').checked = s.autoReschedule;
  $('#settingsWorkStart').value = s.workStart;
  $('#settingsWorkEnd').value = s.workEnd;
  $('#settingsIntensity').value = s.remindIntensity;
  $('#settingsSound').checked = s.soundEnabled;
  $('#settingsVoice').checked = s.voiceEnabled;
  $('#settingsPersonaAge').value = s.personaAge || '';
  $('#settingsPersonaGender').value = s.personaGender || '';
  $('#settingsPersonaStyle').value = s.personaStyle || '';
  $('#settingsPersonaRelation').value = s.personaRelation || '';
  $('#settingsLunchStart').value = s.lunchStart || '12:00';
  $('#settingsLunchDuration').value = s.lunchDuration ?? 90;
  $('#settingsDinnerStart').value = s.dinnerStart || '18:00';
  $('#settingsDinnerDuration').value = s.dinnerDuration ?? 90;
  // 成长日记设置
  const diaryAIResponseEl = $('#settingsDiaryAIResponse');
  if (diaryAIResponseEl) diaryAIResponseEl.checked = s.diaryAIResponse !== false;
  const bedtimeReminderEl = $('#settingsBedtimeReminder');
  if (bedtimeReminderEl) bedtimeReminderEl.checked = s.bedtimeReminder === true;
  const bedtimeTimeEl = $('#settingsBedtimeTime');
  if (bedtimeTimeEl) bedtimeTimeEl.value = s.bedtimeTime || '22:30';
  const diaryCardVisualEl = $('#settingsDiaryCardVisual');
  if (diaryCardVisualEl) diaryCardVisualEl.checked = s.diaryCardVisual !== false;
  // 渲染主题选择器
  const themePicker = $('#themePicker');
  if (themePicker) renderThemePicker(themePicker, s.theme || 'default');
  // 渲染夜间模式选择器
  const themeModePicker = $('#themeModePicker');
  if (themeModePicker) renderThemeModePicker(themeModePicker, s.themeMode || 'system');
  // 渲染吉祥物选择器
  if (typeof renderMascotPicker === 'function') renderMascotPicker();
  $('#settingsModal').classList.add('show');
}

/**
 * 关闭设置弹窗
 */
function closeSettings() { console.log('[closeSettings] 关闭设置弹窗'); $('#settingsModal').classList.remove('show'); }

/**
 * 切换设置面板的折叠/展开
 * @param {HTMLElement} header - 点击的标题元素
 */
function toggleSettingsSection(header) {
  const section = header.closest('.settings-section');
  if (!section) return;
  const body = section.querySelector('.settings-section-body');
  const arrow = section.querySelector('.settings-section-arrow');
  if (!body || !arrow) return;
  
  const isOpen = body.classList.contains('open');
  if (isOpen) {
    body.classList.remove('open');
    arrow.classList.remove('open');
  } else {
    body.classList.add('open');
    arrow.classList.add('open');
  }
}

/**
 * 从设置弹窗中读取值并保存设置
 */
function saveSettingsFromModal() {
  console.log('[saveSettingsFromModal] 保存设置');
  const s = getSettings();
  s.userName = $('#settingsUserName').value.trim();
  s.autoReschedule = $('#settingsAutoReschedule').checked;
  s.workStart = parseInt($('#settingsWorkStart').value) || 9;
  s.workEnd = parseInt($('#settingsWorkEnd').value) || 18;
  s.remindIntensity = $('#settingsIntensity').value;
  s.soundEnabled = $('#settingsSound').checked;
  s.voiceEnabled = $('#settingsVoice').checked;
  s.personaAge = $('#settingsPersonaAge').value.trim();
  s.personaGender = $('#settingsPersonaGender').value.trim();
  s.personaStyle = $('#settingsPersonaStyle').value.trim();
  s.personaRelation = $('#settingsPersonaRelation').value.trim();
  s.lunchStart = $('#settingsLunchStart').value || '12:00';
  s.lunchDuration = parseInt($('#settingsLunchDuration').value) || 0;
  s.dinnerStart = $('#settingsDinnerStart').value || '18:00';
  s.dinnerDuration = parseInt($('#settingsDinnerDuration').value) || 0;
  // 成长日记设置
  const diaryAIResponseEl = $('#settingsDiaryAIResponse');
  if (diaryAIResponseEl) s.diaryAIResponse = diaryAIResponseEl.checked;
  const bedtimeReminderEl = $('#settingsBedtimeReminder');
  if (bedtimeReminderEl) s.bedtimeReminder = bedtimeReminderEl.checked;
  const bedtimeTimeEl = $('#settingsBedtimeTime');
  if (bedtimeTimeEl) s.bedtimeTime = bedtimeTimeEl.value;
  const diaryCardVisualEl = $('#settingsDiaryCardVisual');
  if (diaryCardVisualEl) s.diaryCardVisual = diaryCardVisualEl.checked;
  // 读取主题选择器
  const themePicker = $('#themePicker');
  if (themePicker) s.theme = getSelectedThemeFromPicker(themePicker);
  // 读取夜间模式选择器
  const themeModePicker = $('#themeModePicker');
  if (themeModePicker) s.themeMode = getSelectedThemeMode(themeModePicker);
  saveSettings(s);
  showToast('设置已保存', 'success');
  closeSettings();
}

/**
 * 重置 API 配置，返回设置页面
 */
function resetAPIConfig() {
  console.log('[resetAPIConfig] 重置 API 配置');
  if (SF_API.isDemoMode()) {
    showToast('演示环境已内置配置，无需重新设置', 'info');
    return;
  }
  SF_API.clearConfig();
  closeSettings();
  showSetupPage();
}

/**
 * 恢复出厂设置，清除所有本地数据并刷新页面
 * 点击后会先弹出确认框，用户确认后才执行
 */
function factoryReset() {
  console.log('[factoryReset] 用户点击了恢复出厂设置，弹出确认框');
  const msg = '确定要清除所有数据吗？\n\n这将删除所有任务、日记、设置和 API 配置，且不可恢复。';
  showConfirm(msg, function() {
    console.log('[factoryReset] 用户确认，开始清除数据');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem('sf_onboarding_state'); // 清除引导状态，恢复后重新显示欢迎页
    localStorage.removeItem('sf_bedtime_ball_pos'); // 清除浮动球位置
    SF_API.clearConfig();
    showToast('已恢复初始状态', 'success');
    closeSettings();
    setTimeout(() => location.reload(), 800);
  });
}

// ===== 加载态 =====

/**
 * 显示加载卡片，返回加载元素 ID
 * @param {string} text - 加载提示文字
 * @returns {string} 加载元素的 ID，用于 hideLoading
 */
function showLoading(text) {
  const id = 'loading-' + Date.now();
  const card = createEl('div', 'loading-card');
  card.id = id;
  card.innerHTML = getMascotLoadingHTML(text);
  $('#nextTaskContainer').insertBefore(card, $('#nextTaskContainer').firstChild);
  return id;
}

/**
 * 根据 ID 移除加载卡片
 * @param {string} id - 加载元素的 ID
 */
function hideLoading(id) { const el = document.getElementById(id); if (el) el.remove(); }

/**
 * 在聊天区域显示"思考中"的加载气泡
 * @param {Element} container - 聊天区域 DOM 容器
 * @returns {Element} 加载气泡元素，用于后续移除
 */
function showLoadingBubble(container) {
  const bubble = createEl('div', 'chat-bubble ai');
  bubble.innerHTML = `<span class="speaker">StepForward</span>${getMascotSmallHTML('思考中...')}`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

/**
 * 在主界面显示一条聊天响应消息
 * @param {string} speaker - 说话者名称
 * @param {string} text - 消息内容（支持 Markdown）
 * @param {string} type - 消息类型：'ai' 或 'user'
 */
function showChatResponse(speaker, text, type) {
  const container = $('#nextTaskContainer');
  const bubble = createEl('div', `chat-bubble ${type}`);
  bubble.style.maxWidth = '100%'; bubble.style.margin = '8px 0';
  bubble.innerHTML = `<span class="speaker">${speaker}</span>${md(text)}`;
  container.appendChild(bubble);
}

/**
 * 更新底部待办/已完成计数显示
 */
function updateCounters() {
  const data = getData();
  const pending = data.tasks.filter(t => t.status === 'pending').length;
  const done = data.tasks.filter(t => t.status === 'done').length;
  const pEl = $('#pendingCount');
  const dEl = $('#doneCount');
  if (pEl && pEl.textContent !== String(pending)) bumpCounter($('#pendingBtn'));
  if (dEl && dEl.textContent !== String(done)) bumpCounter($('#doneBtn'));
  if (pEl) pEl.textContent = pending;
  if (dEl) dEl.textContent = done;
  console.log('[updateCounters] 待办:', pending, '已完成:', done);
}

/**
 * 触发计数按钮的跳动动画
 * @param {HTMLElement} btn - 计数按钮元素
 */
function bumpCounter(btn) {
  if (!btn) return;
  btn.classList.remove('bump');
  void btn.offsetWidth; // 强制重排以重启动画
  btn.classList.add('bump');
}

// ===== 页面切换 =====

/**
 * 显示 API 配置页面（首次使用或重置后）
 */
function showSetupPage() {
  console.log('[showSetupPage] 显示配置页面');
  $('#setupPage').style.display = 'block';
  $('#greetingPage').style.display = 'none';
  $('#appPage').style.display = 'none';

  const select = $('#providerSelect');
  select.innerHTML = '';
  Object.entries(SF_API.PROVIDERS).forEach(([key, provider]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${provider.name}${key === 'deepseek' ? '（推荐）' : ''}`;
    select.appendChild(opt);
  });

  select.onchange = updateModelOptions;
  updateModelOptions();
  $('#saveConfigBtn').onclick = handleSaveConfig;
}

/**
 * 根据选中的服务商更新模型下拉选项
 */
function updateModelOptions() {
  const providerKey = $('#providerSelect').value;
  console.log('[updateModelOptions] 更新模型选项，服务商:', providerKey);
  const provider = SF_API.PROVIDERS[providerKey];
  const select = $('#modelSelect');
  select.innerHTML = '';
  provider.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.name;
    if (m.id === provider.defaultModel) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * 验证并保存 API 配置
 * @returns {Promise<void>} 无返回值
 */
async function handleSaveConfig() {
  console.log('[handleSaveConfig] 验证并保存 API 配置');
  const btn = $('#saveConfigBtn');
  btn.disabled = true; btn.textContent = '验证中...';
  const config = { provider: $('#providerSelect').value, apiKey: $('#apiKeyInput').value.trim(), model: $('#modelSelect').value };
  if (!config.apiKey) { showToast('请输入 API Key', 'error'); btn.disabled = false; btn.textContent = '保存配置，继续 →'; return; }
  const result = await SF_API.testAPI(config);
  if (result.ok) {
    console.log('[handleSaveConfig] API 配置验证成功');
    SF_API.saveConfig(config); showToast('配置成功！', 'success'); setTimeout(() => showGreetingPage(), 800);
  } else {
    console.warn('[handleSaveConfig] API 配置验证失败:', result.message);
    showToast(result.message, 'error'); btn.disabled = false; btn.textContent = '保存配置，继续 →';
  }
}

/**
 * 显示问候页面（首次使用，让用户输入昵称）
 */
function showGreetingPage() {
  console.log('[showGreetingPage] 显示问候页面');
  $('#setupPage').style.display = 'none';
  $('#greetingPage').style.display = 'block';
  $('#appPage').style.display = 'none';
  const s = getSettings();
  $('#greetingNameInput').value = s.userName || '';
  $('#greetingContinueBtn').onclick = () => {
    const name = $('#greetingNameInput').value.trim();
    const settings = getSettings();
    settings.userName = name;
    saveSettings(settings);
    showToast(name ? `你好，${name}！很高兴认识你 💗` : '好的，我们开始吧～', 'success');
    setTimeout(() => showApp(), 1000);
  };
  $('#greetingNameInput').onkeydown = (e) => { if (e.key === 'Enter') $('#greetingContinueBtn').click(); };
}

/**
 * 初始化睡前仪式浮动球（拖拽 + 点击确认弹窗）
 */
function initBedtimeFloatBall() {
  const ball = document.getElementById('bedtimeFloatBall');
  if (!ball) return;
  
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  let hasMoved = false;
  
  // 恢复保存的位置
  try {
    const saved = localStorage.getItem('sf_bedtime_ball_pos');
    if (saved) {
      const pos = JSON.parse(saved);
      ball.style.left = pos.left + 'px';
      ball.style.top = pos.top + 'px';
      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
    }
  } catch(e) {}
  
  ball.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = ball.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    ball.classList.add('dragging');
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
    ball.style.left = startLeft + 'px';
    ball.style.top = startTop + 'px';
    e.preventDefault();
  });
  
  ball.addEventListener('touchstart', (e) => {
    isDragging = true;
    hasMoved = false;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    const rect = ball.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    ball.classList.add('dragging');
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
    ball.style.left = startLeft + 'px';
    ball.style.top = startTop + 'px';
  }, { passive: false });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    newLeft = Math.max(0, Math.min(window.innerWidth - 56, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - 56, newTop));
    ball.style.left = newLeft + 'px';
    ball.style.top = newTop + 'px';
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    newLeft = Math.max(0, Math.min(window.innerWidth - 56, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - 56, newTop));
    ball.style.left = newLeft + 'px';
    ball.style.top = newTop + 'px';
  }, { passive: false });
  
  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    ball.classList.remove('dragging');
    // 保存位置
    const rect = ball.getBoundingClientRect();
    try {
      localStorage.setItem('sf_bedtime_ball_pos', JSON.stringify({ left: rect.left, top: rect.top }));
    } catch(e) {}
  };
  
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchend', endDrag);
  
  // 点击事件（没拖动时触发）
  ball.addEventListener('click', (e) => {
    if (hasMoved) return;
    showBedtimeConfirm();
  });
}

/**
 * 显示睡前仪式确认弹窗
 */
function showBedtimeConfirm() {
  // 移除已有弹窗
  const existing = document.getElementById('bedtimeConfirmOverlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'bedtimeConfirmOverlay';
  overlay.className = 'bedtime-confirm-overlay';
  overlay.innerHTML = `
    <div class="bedtime-confirm-dialog">
      <div style="font-size:40px;margin-bottom:12px;">🌙</div>
      <h3>进入睡前仪式？</h3>
      <p>我会陪你回顾今天，一起安心入睡~</p>
      <div class="bedtime-confirm-btns">
        <button class="btn-bedtime-wait" id="bedtimeWaitBtn">再等等</button>
        <button class="btn-bedtime-start" id="bedtimeStartBtn">开始吧</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('#bedtimeWaitBtn').onclick = () => overlay.remove();
  overlay.querySelector('#bedtimeStartBtn').onclick = () => {
    overlay.remove();
    if (typeof startBedtimeRitual === 'function') {
      startBedtimeRitual();
    }
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * 显示主应用界面，初始化所有内容
 */
/**
 * 检测过期任务并弹"欢迎回来"分批处理弹窗
 * 在 showApp() 中调用，renderNextTask/scheduleReminders 之前执行
 */

function handleOverdueTasks() {
  const data = getData();
  const now = new Date();
  const overdue = data.tasks.filter(t => {
    if (t.status !== 'pending' || !t.scheduledTime) return false;
    const tTime = parseScheduledDateTime(t.scheduledDate, t.scheduledTime);
    return tTime && tTime < now;
  });

  if (overdue.length === 0) return false;

  console.log('[handleOverdueTasks] 发现', overdue.length, '个过期任务');

  // 按母任务分组
  const groups = {};
  overdue.forEach(t => {
    const key = t.parentTask || t.text;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const settings = getSettings();
  const userName = settings.userName || '';

  const overlay = createEl('div', 'modal-overlay');
  overlay.classList.add('show');
  overlay.style.zIndex = '9999';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '460px';
  modal.style.maxHeight = '80vh';
  modal.style.overflow = 'auto';

  modal.innerHTML = `
    <div style="text-align:center;padding:4px 0 12px;">
      <div style="font-size:17px;font-weight:700;color:var(--accent2);">欢迎回来，${escapeHtml(userName)} 💕</div>
      <div style="font-size:13px;color:var(--ink);margin-top:6px;line-height:1.7;">
        之前的计划中留下了这些任务，<br>想怎么安排一下？
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 10px;background:var(--bg2);border-radius:8px;">
      <input type="checkbox" id="overdueSelectAll" style="width:16px;height:16px;">
      <label for="overdueSelectAll" style="font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;">全选</label>
      <div style="flex:1;"></div>
      <button class="action-btn danger tiny" id="overdueDeleteBtn" style="font-size:11px;">删除</button>
      <button class="action-btn ghost tiny" id="overdueIgnoreBtn" style="font-size:11px;">先不动</button>
      <button class="action-btn secondary tiny" id="overdueDoneBtn" style="font-size:11px;">已完成</button>
    </div>
    <div id="overdueTaskList" style="margin-bottom:12px;"></div>
    <div style="text-align:center;">
      <button class="action-btn ghost" id="overdueSkipBtn" style="font-size:12px;">暂时不处理，先看看</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const taskListEl = modal.querySelector('#overdueTaskList');

  // 由于 grouped 是 renderList 内部的，需要外部可访问
  // 改为在 modal 作用域维护
  let _grouped = {};
  function rebuildGrouped() {
    _grouped = {};
    overdue.filter(t => t.status === 'pending' && !t._handled).forEach(t => {
      const key = t.parentTask || t.text;
      if (!_grouped[key]) _grouped[key] = [];
      _grouped[key].push(t);
    });
  }

  function updateSelectAllCheckbox() {
    const all = overdue.filter(t => t.status === 'pending' && !t._handled);
    const allSelected = all.every(t => t._selected);
    const selectAllCb = modal.querySelector('#overdueSelectAll');
    if (selectAllCb) selectAllCb.checked = allSelected;
  }

  // 重新实现 renderList 使用 _grouped
  function renderListV2() {
    rebuildGrouped();
    const remaining = overdue.filter(t => t.status === 'pending' && !t._handled);
    if (remaining.length === 0) {
      overlay.remove();
      showToast('过期任务已处理完', 'success');
      return false;
    }

    let html = '';
    Object.entries(_grouped).forEach(([event, tasks]) => {
      const allChecked = tasks.every(t => t._selected);
      html += `<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);">
          <input type="checkbox" class="overdue-group-cb" data-event="${escapeHtml(event)}" ${allChecked ? 'checked' : ''} style="width:14px;height:14px;">
          <span style="font-size:12px;font-weight:600;">📋 ${escapeHtml(event)}</span>
          <span style="font-size:10px;color:var(--muted);margin-left:auto;">${tasks.length}个步骤</span>
        </div>`;
      tasks.forEach(t => {
        const timeLabel = t.scheduledTime ? `${t.scheduledDate || ''} ${t.scheduledTime}` : '';
        html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px 6px 24px;border-top:1px solid var(--border);">
          <input type="checkbox" class="overdue-task-cb" data-task-id="${t.id}" ${t._selected ? 'checked' : ''} style="width:14px;height:14px;">
          <span style="font-size:12px;flex:1;">${escapeHtml(t.text)}</span>
          ${timeLabel ? `<span style="font-size:10px;color:var(--muted);">⏰${escapeHtml(timeLabel)}</span>` : ''}
        </div>`;
      });
      html += `</div>`;
    });

    taskListEl.innerHTML = html;

    // 绑定单个复选框
    taskListEl.querySelectorAll('.overdue-task-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const tid = Number(cb.dataset.taskId);
        const task = overdue.find(t => t.id === tid);
        if (task) task._selected = cb.checked;
        updateSelectAllCheckbox();
      });
    });

    // 绑定组复选框
    taskListEl.querySelectorAll('.overdue-group-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const eventName = cb.dataset.event;
        const tasks = _grouped[eventName] || [];
        const checked = cb.checked;
        tasks.forEach(t => { t._selected = checked; });
        tasks.forEach(t => {
          const subCb = taskListEl.querySelector(`[data-task-id="${t.id}"]`);
          if (subCb) subCb.checked = checked;
        });
        updateSelectAllCheckbox();
      });
    });

    return true;
  }

  // 全选
  modal.querySelector('#overdueSelectAll').addEventListener('change', (e) => {
    const checked = e.target.checked;
    overdue.filter(t => t.status === 'pending' && !t._handled).forEach(t => { t._selected = checked; });
    taskListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = checked; });
  });

  // 获取选中的任务
  function getSelected() {
    return overdue.filter(t => t._selected && !t._handled && t.status === 'pending');
  }

  // 先不动：标记 reminded=true，保持 pending，但从弹窗列表移除
  modal.querySelector('#overdueIgnoreBtn').addEventListener('click', () => {
    const selected = getSelected();
    if (selected.length === 0) { showToast('请先勾选任务', 'info'); return; }
    const d = getData();
    selected.forEach(t => {
      const task = d.tasks.find(x => x.id === t.id);
      if (task) task.reminded = true;
      const orig = overdue.find(x => x.id === t.id);
      if (orig) { orig._selected = false; orig._handled = true; }
    });
    saveData(d);
    showToast(`${selected.length}个任务先不动，可在待办清单中查看`, 'info');
    renderListV2();
  });

  // 删除：从任务列表中移除
  modal.querySelector('#overdueDeleteBtn').addEventListener('click', () => {
    const selected = getSelected();
    if (selected.length === 0) { showToast('请先勾选任务', 'info'); return; }
    const d = getData();
    selected.forEach(t => {
      const idx = d.tasks.findIndex(x => x.id === t.id);
      if (idx > -1) d.tasks.splice(idx, 1);
      const orig = overdue.find(x => x.id === t.id);
      if (orig) { orig._selected = false; orig._handled = true; }
    });
    saveDataSync(d);
    showToast(`${selected.length}个任务已删除`, 'success');
    renderListV2();
    updateCounters();
  });

  // 已完成：标记 done，从弹窗列表移除
  modal.querySelector('#overdueDoneBtn').addEventListener('click', () => {
    const selected = getSelected();
    if (selected.length === 0) { showToast('请先勾选任务', 'info'); return; }
    const d = getData();
    selected.forEach(t => {
      const task = d.tasks.find(x => x.id === t.id);
      if (task) {
        task.status = 'done';
        task.completedAt = new Date().toISOString();
      }
      const orig = overdue.find(x => x.id === t.id);
      if (orig) { orig._selected = false; orig._handled = true; }
    });
    saveDataSync(d);
    showToast(`${selected.length}个任务已标记完成 ✨`, 'success');
    renderListV2();
    updateCounters();
  });

  // 暂时不处理
  modal.querySelector('#overdueSkipBtn').addEventListener('click', () => {
    overlay.remove();
  });

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  renderListV2();
  return true;
}

function showApp() {
  console.log('[showApp] 显示主应用界面');
  $('#setupPage').style.display = 'none';
  $('#greetingPage').style.display = 'none';
  $('#appPage').style.display = 'block';
  $('#todayDate').textContent = todayStr();

  const s = getSettings();
  if (s.userName) {
    const greeting = createEl('div');
    greeting.style.cssText = 'padding:12px 16px;background:var(--warm-bg);border-radius:10px;margin-bottom:16px;font-size:13px;';
    greeting.innerHTML = `👋 <strong>${s.userName}</strong>，今天想做点什么？不管多大的事，我们都可以拆成小步骤慢慢来。`;
    $('#appPage .app-body').insertBefore(greeting, $('#appPage .section-title'));
  }

  showSkeleton();
  renderNextTask();
  hideSkeleton();
  updateCounters();
  scheduleReminders();
  // 检测过期任务，弹"欢迎回来"分批处理弹窗（非阻塞，用户可忽略）
  handleOverdueTasks();
  
  // 初始化用户引导系统
  if (typeof initOnboarding === 'function') {
    initOnboarding();
  }
}

// ===== 语音输入 =====

/**
 * 启动语音输入，使用浏览器 SpeechRecognition API 识别用户语音
 */
function startVoiceInput() {
  console.log('[startVoiceInput] 启动语音输入');
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isHttps = location.protocol === 'https:';
  const isFile = location.protocol === 'file:';

  // 1. 检查浏览器支持
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    let hint = '请使用 Chrome 或 Edge 浏览器';
    if (/iPhone|iPad|iOS/i.test(navigator.userAgent)) hint = 'iOS Safari 暂不支持语音输入，请使用 Chrome 或 Edge 浏览器';
    if (isFile) hint = '当前通过文件方式打开，浏览器不允许语音输入。请通过本地服务器（localhost）打开';
    console.warn('[startVoiceInput] 浏览器不支持语音输入');
    showToast(`当前浏览器不支持语音输入。${hint}`, 'error');
    return;
  }

  // 2. 检查安全上下文（但不强制阻止，让用户尝试）
  if (!isHttps && !isLocalhost && !isFile) {
    showToast('提示：语音输入建议在 HTTPS 或 localhost 环境下使用，当前环境可能无法正常工作', 'info');
  }
  if (isFile) {
    showToast('当前通过文件方式打开，语音输入可能无法使用。请尝试通过本地服务器（localhost）打开', 'info');
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const input = $('#taskInput');
  const btn = $('#voiceInputBtn');
  btn.style.background = 'var(--accent2)';
  btn.style.color = '#fff';
  btn.textContent = '🎙️...';

  let hasResult = false;

  recognition.onstart = () => {
    btn.style.background = 'var(--accent2)';
    btn.style.color = '#fff';
    btn.textContent = '🎙️...';
  };

  recognition.onresult = (event) => {
    hasResult = true;
    const transcript = event.results[0][0].transcript;
    console.log('[startVoiceInput] 语音识别结果:', transcript);
    input.value = transcript;
    btn.textContent = '🎙️';
    btn.style.background = ''; btn.style.color = '';
    showToast('语音识别成功 ✨', 'success');
  };

  recognition.onerror = (e) => {
    console.error('[startVoiceInput] 语音识别错误:', e.error);
    let msg = '语音识别失败';
    switch(e.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        msg = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
        break;
      case 'network':
        msg = '网络连接异常，语音识别需要联网（使用 Google 语音服务）。如果使用代理/VPN，请确保网络通畅';
        break;
      case 'no-speech':
        msg = '没有检测到语音，请靠近麦克风再试一次';
        break;
      case 'audio-capture':
        msg = '未检测到麦克风设备，请检查麦克风是否连接正常';
        break;
      case 'aborted':
        msg = '语音识别被中断，请再试一次';
        break;
      case 'language-not-supported':
        msg = '当前浏览器不支持中文语音识别';
        break;
      default:
        msg = `语音识别失败（${e.error}）。建议：1) 检查网络连接 2) 确认麦克风权限 3) 使用 Chrome 浏览器`;
    }
    showToast(msg, 'error');
    btn.textContent = '🎙️';
    btn.style.background = ''; btn.style.color = '';
  };

  recognition.onend = () => {
    if (!hasResult) {
      btn.textContent = '🎙️';
      btn.style.background = ''; btn.style.color = '';
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('[startVoiceInput] 无法启动语音识别:', e);
    showToast('无法启动语音识别：' + e.message, 'error');
    btn.textContent = '🎙️';
    btn.style.background = ''; btn.style.color = '';
  }
}

// ===== 初始化 =====

/**
 * 应用初始化入口，根据配置状态显示对应页面并绑定所有事件
 */
function init() {
  console.log('[init] 应用初始化开始');
  // 全局兜底：启动"隐形残留弹窗"看门狗（任何页面分支都需要）
  startOverlayWatchdog();
  // 主题与夜间模式：最早阶段应用，避免首屏闪烁
  try { initTheme(); } catch (e) { console.warn('[init] 主题加载失败:', e); }
  if (!SF_API.hasConfig()) { console.log('[init] 无 API 配置，显示配置页面'); showSetupPage(); return; }
  const s = getSettings();
  if (!s.userName) { console.log('[init] 无用户名，显示问候页面'); showGreetingPage(); return; }
  console.log('[init] 配置完整，显示主应用');
  showApp();

  $('#taskInputBtn').addEventListener('click', handleTaskInput);
  $('#taskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleTaskInput(); });
  // 话筒图标：暂时显示"语音功能开发中"提示
  if ($('#voiceInputBtn')) $('#voiceInputBtn').onclick = () => showToast('🎙️ 语音功能开发中，敬请期待~', 'info');
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#closeModal').addEventListener('click', closeEmotionModal);
  $('#emotionModal').addEventListener('click', (e) => { if (e.target.id === 'emotionModal') closeEmotionModal(); });
  $('#pendingBtn').onclick = () => openListModal('pending');
  $('#doneBtn').onclick = () => openListModal('done');
  $('#closeListModal').onclick = closeListModal;
  $('#listModal').onclick = (e) => { if (e.target.id === 'listModal') closeListModal(); };

  // 成长日记
  if ($('#diaryBtn')) $('#diaryBtn').onclick = openDiaryModal;
  if ($('#closeDiaryModal')) $('#closeDiaryModal').onclick = closeDiaryModal;
  if ($('#diaryModal')) $('#diaryModal').onclick = (e) => { if (e.target.id === 'diaryModal') closeDiaryModal(); };
  if ($('#writeDiaryBtn')) $('#writeDiaryBtn').onclick = () => openDiaryEditor(null);
  // 睡前仪式浮动球
  initBedtimeFloatBall();
  if ($('#closeDiaryEditModal')) $('#closeDiaryEditModal').onclick = closeDiaryEditor;
  if ($('#diaryEditModal')) $('#diaryEditModal').onclick = (e) => { if (e.target.id === 'diaryEditModal') closeDiaryEditor(); };
  if ($('#diarySaveBtn')) $('#diarySaveBtn').onclick = saveManualDiary;
  if ($('#diaryDeleteBtn')) $('#diaryDeleteBtn').onclick = deleteManualDiary;
  if ($('#diaryFilterBar')) $('#diaryFilterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-diary-filter]');
    if (!btn) return;
    _diaryFilter = btn.dataset.diaryFilter;
    $('#diaryFilterBar').querySelectorAll('[data-diary-filter]').forEach(b => b.classList.toggle('filter-btn-active', b === btn));
    renderDiaryList();
  });
  if ($('#diaryContent')) $('#diaryContent').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveManualDiary(); }
  });
  // 心情标签选择
  if ($('#diaryMoodTags')) {
    $('#diaryMoodTags').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-mood]');
      if (!chip) return;
      setDiaryMood(chip.dataset.mood);
    });
  }
  // 编辑/预览标签切换
  if ($('#diaryTabWrite')) $('#diaryTabWrite').onclick = () => setDiaryTab('write');
  if ($('#diaryTabPreview')) $('#diaryTabPreview').onclick = () => setDiaryTab('preview');
  $('#saveSettingsBtn').onclick = saveSettingsFromModal;
  $('#closeSettingsBtn').onclick = closeSettings;
  $('#resetAPIConfigBtn').onclick = resetAPIConfig;
  // 演示模式：隐藏"重新配置 API Key"按钮（配置由服务端代理内置）
  if (SF_API.isDemoMode() && $('#resetAPIConfigBtn')) $('#resetAPIConfigBtn').style.display = 'none';
  $('#factoryResetBtn').onclick = factoryReset;
  $('#settingsModal').onclick = (e) => { if (e.target.id === 'settingsModal') closeSettings(); };
  // 重新查看引导
  const restartTourBtn = $('#restartTourBtn');
  if (restartTourBtn) {
    restartTourBtn.onclick = () => {
      closeSettings();
      if (typeof restartTour === 'function') {
        restartTour();
      }
    };
  }
  // 夜间模式选择器：点击实时预览
  if ($('#themeModePicker')) {
    $('#themeModePicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-mode]');
      if (!btn) return;
      $('#themeModePicker').querySelectorAll('.theme-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      try { applyThemeMode(btn.dataset.themeMode); } catch (err) { console.warn('[themeModePicker] 切换失败:', err); }
    });
  }
  if ($('#exportAllEmotionBtn')) {
    $('#exportAllEmotionBtn').onclick = exportAllEmotionHistory;
  }
  if ($('#exportAllDiaryBtn')) {
    $('#exportAllDiaryBtn').onclick = exportAllDiaryHistory;
  }

  // 情绪陪伴输入框（始终存在）
  if ($('#emotionSendBtn')) {
    $('#emotionSendBtn').onclick = sendEmotionMessage;
    $('#emotionInput').onkeydown = (e) => { if (e.key === 'Enter') sendEmotionMessage(); };
  }
  console.log('[init] 事件绑定完成');

  }

/**
 * 看门狗：定期清理"创建后长时间未加 .show 类"的残留隐形弹窗。
 * 这类弹窗 opacity 为 0 但仍会挡住点击，是"页面按钮集体失灵"的根因之一。
 * 每 5 秒扫描一次，清理存在超过 10 秒且始终未显示的动态弹窗。
 */
function startOverlayWatchdog() {
  if (window._overlayWatchdogTimer) return; // 防止重复启动
  window._overlayWatchdogTimer = setInterval(() => {
    const now = Date.now();
    // 清理残留隐形 modal-overlay（超过 10 秒未显示）
    document.querySelectorAll('.modal-overlay:not(.show)').forEach(ov => {
      const created = parseInt(ov.dataset.created || '0', 10);
      if (created && now - created > 10000) {
        console.warn('[overlayWatchdog] 清理残留隐形弹窗:', ov);
        ov.remove();
      }
    });
    // 清理残留 praise-overlay（超过 35 秒未关闭，30秒自动关闭+5秒余量）
    document.querySelectorAll('.praise-overlay').forEach(ov => {
      const created = parseInt(ov.dataset.created || '0', 10);
      if (created && now - created > 35000) {
        console.warn('[overlayWatchdog] 清理残留夸奖弹窗:', ov);
        ov.remove();
      }
    });
  }, 5000);
}

// 全局 JS 错误监听：记录到控制台，便于排查"按钮失灵"等问题
window.addEventListener('error', (e) => {
  console.error('[GlobalError]', e.message, 'at', e.filename, ':', e.lineno);
});

// ===== 情绪陪伴：发送用户消息 =====

/**
 * 在情绪陪伴模态框中发送用户输入的消息，AI 分类后继续干预
 * @returns {Promise<void>} 无返回值
 */
async function sendEmotionMessage() {
  const input = $('#emotionInput');
  const text = input.value.trim();
  if (!text) return;
  
  // 危机检测：前端关键词预筛
  if (detectCrisisSignal(text)) {
    showCrisisResponse(text);
    return;
  }
  
  console.log('[sendEmotionMessage] 用户发送情绪消息:', text);
  input.value = '';

  const container = $('#emotionChatArea');
  const userBubble = createEl('div', 'chat-bubble user');
  userBubble.innerHTML = `<span class="speaker">我</span>${md(text)}`;
  container.appendChild(userBubble);

  // 移除之前的选项按钮（但保留历史对话）
  container.querySelectorAll('.mood-selector').forEach(el => el.remove());

  // AI 分类并回应
  const loadingBubble = showLoadingBubble(container);
  let level = 1;
  try {
    const clsResult = await SF_API.callAI(
      [{ role: 'user', content: SF_PROMPT.buildEmotionClassifierPrompt(text) }],
      '你是情绪分类助手。只返回一个数字。'
    );
    const match = clsResult.match(/[1-4]/);
    if (match) level = parseInt(match[0]);
    console.log('[sendEmotionMessage] AI 情绪分类结果等级:', level);
  } catch (e) { console.warn('[sendEmotionMessage] 情绪分类失败:', e); }
  loadingBubble.remove();

  await continueEmotionIntervention(text, level);
}

/**
 * 处理主界面任务输入框的提交，触发任务拆解
 */
function handleTaskInput() {
  const input = $('#taskInput');
  const value = input.value.trim();
  if (!value) { showToast('请输入要做的事情', 'error'); return; }
  console.log('[handleTaskInput] 用户输入任务:', value);
  input.value = '';
  breakDownTask(value);
  // 触发引导事件：用户提交了任务
  document.dispatchEvent(new CustomEvent('tour:taskSubmitted'));
}

document.addEventListener('DOMContentLoaded', init);

// ===== 成长日记模块 =====

let _diaryFilter = 'all';
let _editingDiaryId = null;

const DIARY_TYPE_META = {
  achievement: { label: '完成', icon: '✨', cls: 'achievement' },
  manual:      { label: '手写', icon: '✍️', cls: 'manual' },
  bedtime:     { label: '晚安', icon: '🌙', cls: 'bedtime' },
};

/**
 * 打开成长日记弹窗
 */
function openDiaryModal() {
  console.log('[openDiaryModal] 打开成长日记弹窗');
  renderDiaryList();
  $('#diaryModal').classList.add('show');
}

/**
 * 关闭成长日记弹窗
 */
function closeDiaryModal() {
  console.log('[closeDiaryModal] 关闭成长日记弹窗');
  $('#diaryModal').classList.remove('show');
}

/**
 * 获取所有日记并按日期倒序、时间倒序排序
 * @returns {Array} 规范化后的日记数组
 */
function getSortedDiary() {
  const data = getData();
  const diary = (data.diary || []).map(normalizeDiaryEntry);
  diary.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (da !== db) return da < db ? 1 : -1;
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });
  return diary;
}

/**
 * 渲染日记列表（含类型筛选）
 */
function renderDiaryList() {
  const container = $('#diaryModalContent');
  if (!container) return;
  const diary = getSortedDiary();
  const filtered = _diaryFilter === 'all' ? diary : diary.filter(d => d.type === _diaryFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px 16px;color:var(--muted);font-size:13px;">
      <div style="font-size:36px;margin-bottom:10px;">📖</div>
      <div>还没有日记，点击右上角「写日记」记录此刻吧</div>
    </div>`;
    return;
  }

  const grouped = {};
  filtered.forEach(d => { (grouped[d.date] = grouped[d.date] || []).push(d); });

  let html = '';
  Object.keys(grouped).forEach(dateStr => {
    const items = grouped[dateStr];
    const isToday = dateStr === todayDateStr();
    const dateLabel = isToday ? '今天' : formatDateLabel(dateStr);
    html += `<div style="margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:700;color:var(--accent2);">${dateLabel}</span>
        <span style="font-size:11px;color:var(--muted);">${items.length} 条记录</span>
        <span style="flex:1;border-bottom:1px dashed var(--rule);"></span>
      </div>`;
    items.forEach(d => {
      const meta = DIARY_TYPE_META[d.type] || DIARY_TYPE_META.manual;
      const timeStr = d.timestamp ? formatTime(new Date(d.timestamp)) : '';
      const moodTag = d.moodTag ? `<span style="font-size:11px;color:var(--muted);margin-left:6px;">${d.moodTag}</span>` : '';
      html += `<div class="diary-item" data-id="${d.id}" data-type="${d.type}" style="margin-bottom:8px;">
        <div class="diary-item-head">
          <span class="diary-type-badge ${meta.cls}">${meta.icon} ${meta.label}</span>
          <span style="font-size:11px;color:var(--muted);">${timeStr}</span>
          ${moodTag}
          <span style="flex:1;"></span>
          ${d.type === 'manual' ? `<button class="diary-edit" data-id="${d.id}" title="编辑" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:13px;">✏️</button>` : ''}
        </div>
        <div class="diary-item-content">${md(d.text || d.content || '')}</div>
        ${d.type === 'achievement' && d.aiResponse
          ? `<button class="diary-praise-toggle" data-id="${d.id}" style="font-size:11px;color:var(--accent2);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;margin-top:4px;">📖 查看夸夸</button><div class="diary-praise-content" data-id="${d.id}" style="display:none;margin-top:6px;"><div class="diary-ai-response"><span class="diary-ai-icon">🌟</span><span class="diary-ai-text">${md(d.aiResponse)}</span></div></div>`
          : (d.aiResponse ? `<div class="diary-ai-response"><span class="diary-ai-icon">🌱</span><span class="diary-ai-text">${md(d.aiResponse)}</span></div>` : (d.respondedAt === null && d.timestamp && (Date.now() - new Date(d.timestamp).getTime() < 60000) ? `<div class="diary-ai-response"><div style="display:flex;align-items:center;gap:6px;">${getMascotSmallHTML('正在回应你...')}</div></div>` : ''))}
      </div>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;

  // 绑定编辑按钮
  container.querySelectorAll('.diary-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      openDiaryEditor(id);
    });
  });

  // 绑定夸夸折叠按钮
  container.querySelectorAll('.diary-praise-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const content = container.querySelector(`.diary-praise-content[data-id="${id}"]`);
      if (content) {
        if (content.style.display === 'none') {
          content.style.display = 'block';
          btn.textContent = '📖 收起夸夸';
        } else {
          content.style.display = 'none';
          btn.textContent = '📖 查看夸夸';
        }
      }
    });
  });
}

/**
 * 将 YYYY-MM-DD 格式化为可读日期（如 8月6日）
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} 可读日期
 */
function formatDateLabel(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
}

/**
 * 打开日记编辑器（新建或编辑）
 * @param {number|null} id - 日记 ID，空则新建
 */
function openDiaryEditor(id) {
  _editingDiaryId = id;
  const data = getData();
  const entry = id ? (data.diary || []).find(d => d.id === id) : null;

  $('#diaryEditTitle').textContent = id ? '✏️ 编辑日记' : '✍️ 写日记';
  $('#diaryContent').value = entry ? (entry.content || entry.text || '') : '';
  setDiaryMood(entry ? (entry.moodTag || '') : '');
  $('#diaryDeleteBtn').style.display = id ? 'block' : 'none';
  // 重置为编辑标签
  setDiaryTab('write');
  $('#diaryEditModal').classList.add('show');
  $('#diaryContent').focus();
}

/**
 * 设置心情标签选中态
 * @param {string} mood - 心情标签值
 */
function setDiaryMood(mood) {
  const wrap = $('#diaryMoodTags');
  if (!wrap) return;
  wrap.querySelectorAll('[data-mood]').forEach(function(btn) {
    btn.classList.toggle('mood-chip-active', btn.dataset.mood === mood);
  });
}

/**
 * 切换编辑/预览标签，并同步内容
 * @param {string} tab - 'write' | 'preview'
 */
function setDiaryTab(tab) {
  const isPreview = tab === 'preview';
  const writeBtn = $('#diaryTabWrite');
  const prevBtn = $('#diaryTabPreview');
  if (writeBtn) writeBtn.classList.toggle('diary-tab-active', !isPreview);
  if (prevBtn) prevBtn.classList.toggle('diary-tab-active', isPreview);
  const ta = $('#diaryContent');
  const pv = $('#diaryPreview');
  if (ta) ta.style.display = isPreview ? 'none' : '';
  if (pv) {
    pv.style.display = isPreview ? 'block' : 'none';
    if (isPreview) {
      const val = (ta && ta.value || '').trim();
      pv.innerHTML = val ? md(val) : '<span style="color:var(--muted);">还没有内容，切回「编辑」开始记录吧。</span>';
    }
  }
}

/**
 * 关闭日记编辑器
 */
function closeDiaryEditor() {
  $('#diaryEditModal').classList.remove('show');
  _editingDiaryId = null;
}

/**
 * 保存手写日记（新建或更新）
 */
function saveManualDiary() {
  const content = $('#diaryContent').value.trim();
  if (!content) { showToast('写点什么再保存吧～', 'error'); return; }
  const moodTag = getSelectedDiaryMood();

  if (_editingDiaryId) {
    // 编辑模式：直接更新，不重新生成AI回应
    const data = getData();
    const entry = (data.diary || []).find(d => d.id === _editingDiaryId);
    if (entry) {
      entry.content = content;
      entry.text = content;
      entry.moodTag = moodTag;
    }
    saveData(data);
    showToast('日记已更新 ✨', 'success');
    closeDiaryEditor();
    renderDiaryList();
  } else {
    // 新建模式：调用 diary.js 的 saveDiaryWithResponse 生成AI回应
    if (typeof saveDiaryWithResponse === 'function') {
      saveDiaryWithResponse(content, moodTag, null).then(() => {
        showToast('日记已保存，正在为你生成回应...', 'success');
        closeDiaryEditor();
        renderDiaryList();
      });
    } else {
      // 兜底：直接保存
      const data = getData();
      data.diary = [...(data.diary || []), {
        id: Date.now(), type: 'manual', date: todayDateStr(),
        text: content, content: content, moodTag: moodTag,
        timestamp: new Date().toISOString(),
      }];
      saveData(data);
      showToast('日记已保存 ✨', 'success');
      closeDiaryEditor();
      renderDiaryList();
    }
  }
}

/**
 * 获取当前选中的心情标签值
 * @returns {string} 心情标签值，未选返回 ''
 */
function getSelectedDiaryMood() {
  const wrap = $('#diaryMoodTags');
  if (!wrap) return '';
  const active = wrap.querySelector('.mood-chip-active');
  return active ? active.dataset.mood : '';
}

/**
 * 删除手写日记
 */
function deleteManualDiary() {
  if (!_editingDiaryId) return;
  showConfirm('确定要删除这篇日记吗？删除后不可恢复。', function() {
    const data = getData();
    data.diary = (data.diary || []).filter(d => !(d.id === _editingDiaryId && d.type === 'manual'));
    saveData(data);
    showToast('日记已删除', 'info');
    closeDiaryEditor();
    renderDiaryList();
  });
}
