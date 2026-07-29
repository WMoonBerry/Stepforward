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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    };
    const settings = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    console.log('[getSettings] 读取设置完成，userName:', settings.userName || '(未设置)');
    return settings;
  } catch (e) {
    console.warn('[getSettings] 读取设置失败，返回默认值:', e);
    return { userName: '', autoReschedule: true, workStart: 9, workEnd: 18, remindIntensity: 'standard', soundEnabled: true, voiceEnabled: true, personaAge: '', personaGender: '', personaStyle: '', personaRelation: '' };
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
  overlay.style.display = 'flex';
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
    '你是任务拆解助手。只返回 JSON。'
  );

  let parsed;
  try {
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleaned);
    console.log('[callBreakdownAI] JSON 解析成功，任务组数:', parsed.tasks ? parsed.tasks.length : 0);
  } catch (e) {
    console.warn('[callBreakdownAI] JSON 解析失败，降级处理:', result);
    parsed = { tasks: [{ parentTask: taskInput, steps: result.split('\n').filter(l => l.trim() && l.match(/^\d+[\.\)]/)).slice(0, 5).map(l => ({ text: l.replace(/^\d+[\.\)]\s*/, '').trim(), duration: 10, time: null })) }] };
  }

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
    console.log('[saveBreakdownResult] 父任务:', parentTask.parentTask, '步骤数:', parentTask.steps.length);
    parentTask.steps.forEach(step => {
      data.tasks.push({
        id: now + stepIndex,
        parentTask: parentTask.parentTask,
        text: step.text,
        duration: step.duration || 10,
        scheduledTime: step.time || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        reminded: false,
      });
      stepIndex++;
    });
  });

  saveData(data);
  renderNextTask();
  updateCounters();
  scheduleReminders();
  console.log('[saveBreakdownResult] 保存完成，共', stepIndex, '个步骤');
  return stepIndex;
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
  overlay.style.display = 'flex';
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
      <div style="max-height:45vh;overflow-y:auto;padding:4px 2px;margin-bottom:12px;">
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
      const tTime = parseTimeStr(t.scheduledTime);
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

  const timeLabel = nextTask.scheduledTime ? `${nextTask.scheduledTime}` : '随时可以开始';
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
    const tTime = parseTimeStr(nextTask.scheduledTime);
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
 * 将同一父任务下、时间在指定步骤之后的所有待办步骤顺延
 * @param {number|string} taskId - 当前步骤的 ID
 * @param {number} minutes - 顺延分钟数（正数后推，负数提前）
 * @returns {number} 实际被顺延的步骤数量
 */
function shiftSiblingSteps(taskId, minutes) {
  if (minutes === 0) return 0;
  taskId = Number(taskId);
  const d = getData();
  const task = d.tasks.find(t => t.id === taskId);
  console.log('[shiftSiblingSteps] taskId:', taskId, 'minutes:', minutes, 'task:', task ? task.text : 'not found', 'parentTask:', task ? task.parentTask : 'none');
  if (!task || !task.parentTask) return 0;

  const taskTime = task.scheduledTime ? parseTimeStr(task.scheduledTime) : null;
  console.log('[shiftSiblingSteps] taskTime:', task.scheduledTime, '=>', taskTime);
  let count = 0;

  d.tasks.forEach(t => {
    // 同一事件 + 不是当前步骤 + 待办状态 + 有安排时间
    if (t.parentTask === task.parentTask && t.id !== taskId && t.status === 'pending' && t.scheduledTime) {
      const stepTime = parseTimeStr(t.scheduledTime);
      console.log('[shiftSiblingSteps] checking step:', t.text, 'time:', t.scheduledTime, 'stepTime >= taskTime:', taskTime ? (stepTime >= taskTime) : 'N/A(no taskTime)');
      if (stepTime) {
        // 如果当前步骤有时间，则只顺延时间 >= 当前步骤时间的步骤
        // 如果当前步骤没有时间，则顺延同事件下所有有时间的步骤
        if (!taskTime || stepTime >= taskTime) {
          stepTime.setMinutes(stepTime.getMinutes() + minutes);
          t.scheduledTime = formatTime(stepTime);
          t.reminded = false;
          count++;
          console.log('[shiftSiblingSteps] shifted step:', t.text, 'to:', t.scheduledTime);
        }
      }
    }
  });

  console.log('[shiftSiblingSteps] total shifted:', count);
  if (count > 0) saveData(d);
  return count;
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
  overlay.style.display = 'flex';
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
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // 保存修改（仅未完成状态）
  if (!isDone && $('#saveEditBtn')) {
    $('#saveEditBtn').onclick = () => {
    const newText = $('#editTaskText').value.trim();
    const newDuration = parseInt($('#editTaskDuration').value) || task.duration;
    const newTime = $('#editTaskTime').value.trim() || null;
    console.log('[openTaskMenu] 保存修改，新内容:', newText, '时长:', newDuration, '时间:', newTime);
    if (!newText) { showToast('内容不能为空', 'error'); return; }

    // 计算时间变化量
    let timeDiffMinutes = 0;
    if (task.scheduledTime && newTime) {
      const oldT = parseTimeStr(task.scheduledTime);
      const newT = parseTimeStr(newTime);
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
      saveData(d);
      console.log('[openTaskMenu] 任务已更新');

      // 如果时间或时长有变化，顺延同事件后续步骤
      let shiftedCount = 0;
      if (totalShiftMinutes !== 0) {
        shiftedCount = shiftSiblingSteps(taskId, totalShiftMinutes);
        console.log('[openTaskMenu] 已顺延同事件后续', shiftedCount, '步');
      }

      scheduleReminders();
      if (shiftedCount > 0) {
        const shiftDir = totalShiftMinutes > 0 ? '后推' : '提前';
        const shiftAbs = Math.abs(totalShiftMinutes);
        showToast(`已保存修改，后续 ${shiftedCount} 步已同步${shiftDir} ${shiftAbs} 分钟`, 'success');
      } else {
        showToast('已保存修改', 'success');
      }
      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
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
        reAddStepsToPending(stepCopy, task.parentTask);
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
        saveData(d);
        console.log('[openTaskMenu] 任务已删除，剩余任务数:', d.tasks.length);
        showToast('已删除', 'success');
        overlay.remove();
        if (source === 'pending' || source === 'done') {
          openListModal(source);
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
  const pending = data.tasks.filter(t => t.status === 'pending' && t.scheduledTime);
  const conflicts = [];

  steps.forEach(step => {
    if (!step.scheduledTime) return;
    const stepTime = parseTimeStr(step.scheduledTime);
    if (!stepTime) return;
    const stepEnd = new Date(stepTime.getTime() + (step.duration || 10) * 60000);

    pending.forEach(p => {
      if (!p.scheduledTime) return;
      const pTime = parseTimeStr(p.scheduledTime);
      if (!pTime) return;
      const pEnd = new Date(pTime.getTime() + (p.duration || 10) * 60000);

      // 检查时间重叠
      if (stepTime < pEnd && stepEnd > pTime) {
        if (!conflicts.find(c => c.id === p.id)) {
          conflicts.push(p);
        }
      }
    });
  });

  console.log('[findTimeConflicts] 检查到冲突数:', conflicts.length);
  return conflicts;
}

/**
 * 显示时间冲突处理弹窗
 * @param {Array<Object>} conflicts - 冲突的任务列表
 * @param {Array<Object>} stepsToAdd - 要加入的步骤
 * @param {string} parentTaskName - 父任务名称
 */
function showConflictResolution(conflicts, stepsToAdd, parentTaskName) {
  console.log('[showConflictResolution] 显示时间冲突处理弹窗，冲突数:', conflicts.length);

  let conflictHtml = '';
  conflicts.forEach(c => {
    conflictHtml += `<div style="padding:6px 10px;background:var(--bg2);border-radius:8px;margin-bottom:6px;font-size:12px;">
      ⏰ ${c.scheduledTime} · ${escapeHtml(c.text)}${c.parentTask ? `（${escapeHtml(c.parentTask)}）` : ''}
    </div>`;
  });

  const overlay = createEl('div', 'modal-overlay');
  overlay.style.display = 'flex';
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
      const conflictsDesc = conflicts.map(c => `- ${c.text}（${c.scheduledTime}，${c.duration}分钟）`).join('\n');

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

      // 删除冲突的旧任务
      const d = getData();
      const conflictIds = conflicts.map(c => c.id);
      d.tasks = d.tasks.filter(t => !conflictIds.includes(t.id));
      saveData(d);

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
 * @param {string} parentTaskName - 父任务名称
 */
function reAddStepsToPending(steps, parentTaskName) {
  console.log('[reAddStepsToPending] 重新加入待办，步骤数:', steps.length, '事件:', parentTaskName);

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
    saveData(d);
    renderNextTask();
    updateCounters();
    scheduleReminders();
    showToast(`已重新加入 ${steps.length} 个步骤到待办`, 'success');
  }
}

// ===== 事件分类菜单（整体修改/删除/提前完成）=====

/**
 * 打开整个父任务（事件分类）的操作菜单，支持整体时间偏移、删除、提前完成
 * @param {string} parentName - 父任务名称
 * @param {string} source - 调用来源：'main' / 'pending' / 'done'
 */
function openParentTaskMenu(parentName, source) {
  console.log('[openParentTaskMenu] 被调用, parentName:', parentName, 'source:', source);
  const data = getData();
  const steps = data.tasks.filter(t => t.parentTask === parentName);
  console.log('[openParentTaskMenu] 找到步骤数:', steps.length);
  if (steps.length === 0) {
    console.warn('[openParentTaskMenu] 没有找到属于该父任务的步骤');
    return;
  }

  const pendingCount = steps.filter(s => s.status === 'pending').length;
  const doneCount = steps.filter(s => s.status === 'done').length;
  const isDone = source === 'done';
  const titleText = isDone ? '已完成的事件' : '修改整件事';

  const overlay = createEl('div', 'modal-overlay');
  overlay.style.display = 'flex';
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
    parentBodyHtml = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">${titleText}</h3>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;">${escapeHtml(parentName)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">
        共 ${steps.length} 步 · 待办 ${pendingCount} · 已完成 ${doneCount}
      </div>
    </div>

    <div style="margin-bottom:8px;font-size:12px;color:var(--muted);">
      将整件事的所有步骤提前或后推（正数=后推，负数=提前）：
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
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // 保存修改（时间偏移，仅未完成状态）
  if (!isDone && $('#saveParentShiftBtn')) {
    $('#saveParentShiftBtn').onclick = () => {
    const hours = parseInt($('#shiftHours').value) || 0;
    const minutes = parseInt($('#shiftMinutes').value) || 0;
    const totalMinutes = hours * 60 + minutes;
    console.log('[openParentTaskMenu] 时间偏移，小时:', hours, '分钟:', minutes, '总计:', totalMinutes, '分钟');

    if (totalMinutes === 0) {
      showToast('没有变化哦～', 'info');
      return;
    }

    const direction = totalMinutes > 0 ? '后推' : '提前';
    const absHours = Math.abs(hours);
    const absMins = Math.abs(minutes);
    let timeStr = '';
    if (absHours > 0) timeStr += absHours + '小时';
    if (absMins > 0) timeStr += absMins + '分钟';

    const msg = `确定要将 "${parentName}" 的所有步骤${direction} ${timeStr}吗？`;
    // 收集所有需要修改的步骤ID
    const stepIds = steps.map(s => s.id);
    showConfirm(msg, function() {
      console.log('[openParentTaskMenu] 用户确认时间偏移，开始执行');
      const d = getData();
      let modifiedCount = 0;
      stepIds.forEach(sid => {
        const t = d.tasks.find(x => x.id === sid);
        if (t && t.scheduledTime) {
          const tTime = parseTimeStr(t.scheduledTime);
          if (tTime) {
            tTime.setMinutes(tTime.getMinutes() + totalMinutes);
            t.scheduledTime = formatTime(tTime);
            t.reminded = false;
            modifiedCount++;
          }
        }
      });
      saveData(d);
      console.log('[openParentTaskMenu] 时间偏移完成，修改了', modifiedCount, '个步骤');
      scheduleReminders();
      showToast(`已${direction} ${timeStr}`, 'success');
      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
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
        reAddStepsToPending(stepsCopy, parentName);
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
      saveData(d);
      console.log('[openParentTaskMenu] 整件事已删除，剩余任务数:', d.tasks.length);
      showToast('已删除整件事', 'success');
      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
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
      d.tasks.forEach(t => {
        if (t.parentTask === parentName && t.status === 'pending') {
          t.status = 'done';
          t.completedAt = now;
          d.diary = [...(d.diary || []), { id: Date.now() + Math.random(), type: 'achievement', text: '完成了：' + t.text, timestamp: now }];
          completedCount++;
        }
      });
      saveData(d);
      console.log('[openParentTaskMenu] 整件事完成，标记了', completedCount, '个步骤');
      playSmallCelebration();
      playNotificationSound();

      // 幼教语气夸奖
      var settings = getSettings();
      var praisePrompt = '用户刚刚完成了整件事："' + parentName + '"（共' + steps.length + '个步骤）。请用温柔、软萌、真诚的语气夸奖用户，像一个很会夸人的好朋友。要求：1. 多用"你"字，少提"我"；2. 具体提到完成的这件事，不要空泛；3. 2-3句话；4. 以"你真的好棒！"开头。';

      try {
        SF_API.callAI(
          [{ role: 'user', content: praisePrompt }],
          '你是一个温柔软萌、很会夸人的陪伴者。语气真诚温暖，多用"你"，少提"我"。'
        ).then(function(praise) {
          showPraise(praise);
        }).catch(function(err) {
          showPraise('你真的好棒！完成了"' + parentName + '"的全部' + steps.length + '个步骤，你太厉害了～✨');
        });
      } catch (e) {
        showPraise('你真的好棒！完成了"' + parentName + '"的全部' + steps.length + '个步骤，你太厉害了～✨');
      }

      overlay.remove();
      if (source === 'pending' || source === 'done') {
        openListModal(source);
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
  data.diary = [...(data.diary || []), { id: Date.now(), type: 'achievement', text: `完成了：${task.text}`, timestamp: new Date().toISOString() }];
  saveData(data);
  renderNextTask();
  updateCounters();

  // 小庆祝烟花
  playSmallCelebration();
  playNotificationSound();

  // 幼教语气夸奖（30秒自动消失）
  const settings = getSettings();
  const praisePrompt = '用户刚刚完成了："' + task.text + '"。请用温柔、软萌、真诚的语气夸奖用户，像一个很会夸人的好朋友。要求：1. 多用"你"字，少提"我"；2. 具体提到完成的这件事，不要空泛；3. 2-3句话；4. 以"你真的好棒！"开头。';

  try {
    SF_API.callAI(
      [{ role: 'user', content: praisePrompt }],
      '你是一个温柔软萌、很会夸人的陪伴者。语气真诚温暖，多用"你"，少提"我"。'
    ).then(function(praise) {
      showPraise(praise, 30); // 30秒自动关闭
    }).catch(function(err) {
      showPraise('你真的好棒！完成了"' + task.text + '"，你太厉害了～✨', 30);
    });
  } catch (e) {
    showPraise('你真的好棒！完成了"' + task.text + '"，你太厉害了～✨', 30);
  }

  console.log('[markDone] 已写入日记记录');
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
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;display:flex;align-items:center;justify-content:center;';

  var card = document.createElement('div');
  card.style.cssText = 'background:linear-gradient(135deg, #fff9e6 0%, #ffe4ec 100%);padding:32px 28px;border-radius:20px;max-width:360px;margin:20px;text-align:center;box-shadow:0 10px 40px rgba(255,150,180,0.3);border:2px solid #ffd6e0;';

  var hintText = autoCloseSeconds > 0
    ? `<div style="margin-top:18px;font-size:11px;color:#c9a0b0;opacity:0.8;">${autoCloseSeconds}秒后自动关闭 · 点击任意处继续</div>`
    : `<div style="margin-top:18px;font-size:11px;color:#c9a0b0;opacity:0.8;">点击任意处继续</div>`;

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
    d2.diary = [...(d2.diary || []), { id: Date.now(), type: 'achievement', text: '完成了：' + t2.text, timestamp: new Date().toISOString() }];
    saveData(d2);
    console.log('[markDoneFromList] 任务已标记完成，开始 AI 夸奖');

    // 小庆祝
    playSmallCelebration();
    playNotificationSound();

    // 幼教语气夸奖 - 不要自称老师，多用"你"，少提"我"
    var settings = getSettings();
    var userName = settings.userName || '宝贝';
    var praisePrompt = '用户刚刚完成了："' + t2.text + '"。请用温柔、软萌、真诚的语气夸奖用户，像一个很会夸人的好朋友。要求：1. 多用"你"字，少提"我"；2. 具体提到完成的这件事，不要空泛；3. 2-3句话；4. 以"你真的好棒！"开头。';

    try {
      SF_API.callAI(
        [{ role: 'user', content: praisePrompt }],
        '你是一个温柔软萌、很会夸人的陪伴者。语气真诚温暖，多用"你"，少提"我"。'
      ).then(function(praise) {
        showPraise(praise);
      }).catch(function(err) {
        showPraise('你真的好棒！完成了"' + t2.text + '"，你太厉害了～✨');
      });
    } catch (e) {
      showPraise('你真的好棒！完成了"' + t2.text + '"，你太厉害了～✨');
    }

    // 刷新清单
    openListModal('pending');
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
 * @param {string} parentTask - 父任务名称（冗余存储）
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
  overlay.style.display = 'flex';
  overlay.style.zIndex = '4000';

  const modal = createEl('div', 'modal');
  modal.style.maxWidth = '460px';
  modal.innerHTML = `
    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    <h3 style="color:var(--accent2);margin-top:0;">💬 陪伴回顾</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
      ${history.parentTask ? '<span style="display:inline-block;background:var(--bg2);padding:2px 8px;border-radius:100px;margin-right:6px;">' + escapeHtml(history.parentTask) + '</span>' : ''}
      ${escapeHtml(history.taskText)}
    </div>
    <div id="historyChatArea" class="chat-area" style="max-height:55vh;overflow-y:auto;"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

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
function closeListModal() { console.log('[closeListModal] 关闭清单模态框'); $('#listModal').classList.remove('show'); }

/**
 * 在情绪陪伴区域显示原因选择按钮
 * @param {Element} container - 聊天区域 DOM 容器
 */
function showReasonSelector(container) {
  console.log('[showReasonSelector] 显示原因选择器');
  const reasons = [
    { key: 'lazy', text: '就是没心情 / 懒得动', level: 1 },
    { key: 'overwhelm', text: '事情太多太乱了', level: 2 },
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
  emotionConversationHistory.push({ role: 'user', content: reasonText });

  const container = $('#emotionChatArea');
  const settings = getSettings();
  const loadingBubble = showLoadingBubble(container);

  try {
    console.log('[continueEmotionIntervention] 调用 AI 生成情绪支持回复...');
    const historyStr = emotionConversationHistory.map(h => `${h.role === 'user' ? '用户' : '你'}: ${h.content}`).join('\n');
    const userName = settings.userName || '';

    const prompt = `你是一位经验丰富的中年女性心理咨询师，从业20年。

${userName ? `用户叫${userName}。` : ''}
用户在面对任务时选择了"等一下"。

用户的表达："${reasonText}"

之前的对话：
${historyStr}

【极其重要的说话规则——违反任何一条都是严重错误】
❌ 绝对禁止：
- 不说"我懂你的感受"（除非你能具体说出是什么感受）
- 不说"一切都会好起来的"、"加油"、"振作一点"
- 不说"别想太多了"、"想开点"
- 不说任何可以用来安慰任何人的万能句式

✅ 必须做到：
1. 第一句话具体描述用户的状态——用用户的原话，比如"你说'明明知道该做但身体就是不想动，然后心里又开始怪自己'——这种双重拉扯真的特别消耗人"
2. 短段落。每段最多2-3句话，然后分段（换行）
3. 一次只说一件事。先接住情绪，再说别的
4. 如果合适，给一个极其微小的、不需要意志力的动作建议
5. 用 **加粗** 标出最关键的那1-2个词

80-150字。`;

    const response = await SF_API.callAI(
      [{ role: 'user', content: prompt }],
      SF_PROMPT.buildSystemPrompt('emotional_supporter', settings)
    );

    loadingBubble.remove();
    emotionConversationHistory.push({ role: 'assistant', content: response });
    console.log('[continueEmotionIntervention] AI 回复完成，长度:', response.length);

    const aiBubble = createEl('div', 'chat-bubble ai');
    aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(response)}`;
    container.appendChild(aiBubble);

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

    const response = await SF_API.callAI(
      [{ role: 'user', content: deeperPrompt }],
      SF_PROMPT.buildSystemPrompt('emotional_supporter', settings)
    );

    loadingBubble.remove();
    emotionConversationHistory.push({ role: 'assistant', content: response });

    const aiBubble = createEl('div', 'chat-bubble ai');
    aiBubble.innerHTML = `<span class="speaker">StepForward</span>${md(response)}`;
    container.appendChild(aiBubble);

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

  saveData(data);

  // 顺延同事件的后续步骤
  let shiftedCount = 0;
  if (task) {
    shiftedCount = shiftSiblingSteps(currentWaitTaskId, minutes);
    console.log('[doReschedule] 同事件后续步骤顺延数:', shiftedCount);
  }

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
    const taskTime = parseTimeStr(task.scheduledTime);
    if (!taskTime) return;
    const diff = taskTime - now;
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
  overlay.style.display = 'flex'; overlay.style.zIndex = '2000';

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

  $('#reminderDone').onclick = () => { overlay.remove(); markDone(task.id); };
  $('#reminderWait').onclick = () => { overlay.remove(); markWait(task.id); };
}

// ===== 清单弹窗 =====

/**
 * 打开待办/已完成清单弹窗，按父任务分组显示
 * @param {string} type - 清单类型：'pending'（待办）或 'done'（已完成）
 */
function openListModal(type) {
  console.log('[openListModal] 打开清单，类型:', type);
  const data = getData();
  const tasks = type === 'pending'
    ? data.tasks.filter(t => t.status === 'pending')
    : data.tasks.filter(t => t.status === 'done');
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
    const t = parseTimeStr(step.scheduledTime);
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
  if (tasks.length === 0) {
    html = `<p style="text-align:center;color:var(--muted);padding:20px;">${emptyText}</p>`;
  } else {
    sortedGroups.forEach(([parent, steps]) => {
      const parentEncoded = encodeURIComponent(parent);
      html += `<div style="margin-bottom:16px;">
        <div class="parent-task-header" data-parent="${parentEncoded}" style="padding:8px 4px;cursor:pointer;border-radius:8px;transition:background 0.2s;" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'">
          <span style="font-size:13px;font-weight:700;color:var(--accent);">${escapeHtml(parent)}</span>
          <span style="font-weight:400;opacity:0.7;font-size:11px;">(${steps.length}步)</span>
          <span style="font-size:10px;color:var(--muted);margin-left:6px;opacity:0.6;">点击修改 ›</span>
        </div>`;
      steps.forEach(t => {
        const isDone = t.status === 'done';
        const clickable = !isDone && type === 'pending';
        html += `
          <div style="padding:8px 12px;display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--rule);">
            <div class="step-checkbox" data-task-id="${t.id}" style="width:18px;height:18px;border-radius:5px;border:2px solid ${isDone ? 'var(--accent3)' : 'var(--accent)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;${isDone ? 'background:var(--accent3);color:#fff;' : ''}${clickable ? 'cursor:pointer;' : ''}" title="${clickable ? '点击标记为完成' : ''}">${isDone ? '✓' : ''}</div>
            <div style="flex:1;">
              <div style="font-size:12.5px;${isDone ? 'text-decoration:line-through;opacity:0.6;' : ''}">${escapeHtml(t.text)}</div>
              <div style="font-size:10.5px;color:var(--muted);margin-top:2px;">
                ${t.scheduledTime || '未安排'}${t.duration ? ` · ${t.duration}分钟` : ''}
              </div>
            </div>
            <button class="menu-btn" style="width:28px;height:28px;border-radius:8px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;" data-task-id="${t.id}" title="修改/删除">⋮</button>
          </div>`;
      });
      html += `</div>`;
    });
  }

  $('#listModalTitle').textContent = title;
  $('#listModalContent').innerHTML = html;
  $('#listModal').classList.add('show');

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
  $('#settingsModal').classList.add('show');
}

/**
 * 关闭设置弹窗
 */
function closeSettings() { console.log('[closeSettings] 关闭设置弹窗'); $('#settingsModal').classList.remove('show'); }

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
  saveSettings(s);
  showToast('设置已保存', 'success');
  closeSettings();
}

/**
 * 重置 API 配置，返回设置页面
 */
function resetAPIConfig() {
  console.log('[resetAPIConfig] 重置 API 配置');
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
  card.innerHTML = `<div class="spinner"></div><div class="loading-text">${text}</div>`;
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
  bubble.innerHTML = `<span class="speaker">StepForward</span><span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid var(--accent-soft);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span>思考中...`;
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
  $('#pendingCount').textContent = pending;
  $('#doneCount').textContent = done;
  console.log('[updateCounters] 待办:', pending, '已完成:', done);
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
 * 显示主应用界面，初始化所有内容
 */
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

  renderNextTask();
  updateCounters();
  scheduleReminders();
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
  if (!SF_API.hasConfig()) { console.log('[init] 无 API 配置，显示配置页面'); showSetupPage(); return; }
  const s = getSettings();
  if (!s.userName) { console.log('[init] 无用户名，显示问候页面'); showGreetingPage(); return; }
  console.log('[init] 配置完整，显示主应用');
  showApp();

  $('#taskInputBtn').addEventListener('click', handleTaskInput);
  $('#taskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleTaskInput(); });
  if ($('#voiceInputBtn')) $('#voiceInputBtn').onclick = startVoiceInput;
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#closeModal').addEventListener('click', closeEmotionModal);
  $('#emotionModal').addEventListener('click', (e) => { if (e.target.id === 'emotionModal') closeEmotionModal(); });
  $('#pendingBtn').onclick = () => openListModal('pending');
  $('#doneBtn').onclick = () => openListModal('done');
  $('#closeListModal').onclick = closeListModal;
  $('#listModal').onclick = (e) => { if (e.target.id === 'listModal') closeListModal(); };
  $('#saveSettingsBtn').onclick = saveSettingsFromModal;
  $('#closeSettingsBtn').onclick = closeSettings;
  $('#resetAPIConfigBtn').onclick = resetAPIConfig;
  $('#factoryResetBtn').onclick = factoryReset;
  $('#settingsModal').onclick = (e) => { if (e.target.id === 'settingsModal') closeSettings(); };

  // 情绪陪伴输入框（始终存在）
  if ($('#emotionSendBtn')) {
    $('#emotionSendBtn').onclick = sendEmotionMessage;
    $('#emotionInput').onkeydown = (e) => { if (e.key === 'Enter') sendEmotionMessage(); };
  }
  console.log('[init] 事件绑定完成');
}

// ===== 情绪陪伴：发送用户消息 =====

/**
 * 在情绪陪伴模态框中发送用户输入的消息，AI 分类后继续干预
 * @returns {Promise<void>} 无返回值
 */
async function sendEmotionMessage() {
  const input = $('#emotionInput');
  const text = input.value.trim();
  if (!text) return;
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
}

document.addEventListener('DOMContentLoaded', init);
