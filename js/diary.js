// ============================================================
// StepForward · 成长日记模块 v2.2
// ============================================================

// ===== 睡前安心仪式状态 =====
let bedtimeState = {
  step: 0,
  review: [],
  gratitudes: [],
  anxietyText: '',
  anxietySaved: false,
  goodnightMessage: '',
  entryCount: 0  // 今日已进入次数
};

// ===== 手写日记AI回应 =====

/**
 * 生成日记AI回应
 * @param {Object} diaryEntry - 日记条目
 * @returns {Promise<string|null>} AI回应内容
 */
async function generateDiaryResponse(diaryEntry) {
  if (!diaryEntry || diaryEntry.type !== 'manual') return null;
  
  const settings = getSettings();
  if (settings.diaryAIResponse === false) return null;
  
  // 获取今日完成的任务作为上下文
  const data = getData();
  const today = todayDateStr();
  const todayTasks = data.tasks
    .filter(t => t.status === 'done' && t.completedAt && t.completedAt.startsWith(today))
    .map(t => t.text);
  
  const prompt = SF_PROMPT.buildDiaryResponsePrompt(
    diaryEntry.text,
    diaryEntry.mood,
    todayTasks
  );
  
  try {
    const response = await SF_API.callAI(
      [{ role: 'user', content: prompt }],
      SF_PROMPT.buildSystemPrompt('diary_companion', settings)
    );
    return response;
  } catch (e) {
    console.error('[generateDiaryResponse] AI回应失败:', e);
    return null;
  }
}

/**
 * 保存手写日记并生成AI回应
 * @param {string} content - 日记内容
 * @param {string} mood - 心情标签
 * @param {number|null} editId - 编辑的日记ID
 * @returns {Promise<Object>} 日记条目
 */
async function saveDiaryWithResponse(content, mood, editId) {
  const data = getData();
  const now = new Date().toISOString();
  
  let entry;
  if (editId) {
    entry = data.diary.find(d => d.id === editId);
    if (entry) {
      entry.text = content;
      entry.mood = mood;
      entry.timestamp = now;
      entry.aiResponse = null;
      entry.respondedAt = null;
    }
  } else {
    entry = {
      id: Date.now(),
      type: 'manual',
      date: todayDateStr(),
      text: content,
      mood: mood,
      timestamp: now,
      aiResponse: null,
      respondedAt: null
    };
    data.diary.push(entry);
  }
  
  saveData(data);

  // 异步生成AI回应（显示吉祥物加载指示）
  generateDiaryResponse(entry).then(response => {
    if (response) {
      entry.aiResponse = response;
      entry.respondedAt = new Date().toISOString();
      saveData(data);
      // 触发UI更新
      if (document.getElementById('diaryModal').classList.contains('show')) {
        renderDiaryList();
      }
    }
  });

  // 如果日记弹窗正打开，立即显示加载状态
  if (document.getElementById('diaryModal')?.classList.contains('show')) {
    renderDiaryList();
  }
  
  return entry;
}

// ===== 睡前安心仪式 =====

/**
 * 退出睡前安心仪式
 */
function exitBedtimeRitual() {
  if (window._bedtimeOverlay) {
    window._bedtimeOverlay.remove();
    window._bedtimeOverlay = null;
  }
}

/**
 * 启动睡前安心仪式
 */
function startBedtimeRitual() {
  // 检查今日已进入次数
  const today = todayDateStr();
  const data = getData();
  const todayBedtimeEntries = data.diary.filter(d => d.type === 'bedtime' && d.date === today);
  
  bedtimeState = {
    step: 0,
    review: [],
    gratitudes: [],
    anxietyText: '',
    anxietySaved: false,
    goodnightMessage: '',
    entryCount: todayBedtimeEntries.length
  };
  
  showBedtimeStep(0);
}

/**
 * 显示睡前仪式指定步骤
 * @param {number} step - 步骤编号 0-3
 */
function showBedtimeStep(step) {
  bedtimeState.step = step;
  
  switch(step) {
    case 0:
      showBedtimeReview();
      break;
    case 1:
      showBedtimeGratitude();
      break;
    case 2:
      showBedtimeAnxiety();
      break;
    case 3:
      showBedtimeGoodnight();
      break;
  }
}

/**
 * 第一步：回顾今日
 */
function showBedtimeReview() {
  const data = getData();
  const today = todayDateStr();
  const todayDone = data.tasks.filter(t => 
    t.status === 'done' && 
    t.completedAt && 
    t.completedAt.startsWith(today)
  );
  
  bedtimeState.review = todayDone.map(t => ({
    text: t.text,
    parentTask: t.parentTask
  }));
  
  let listHtml = '';
  if (bedtimeState.review.length > 0) {
    listHtml = bedtimeState.review.map(r => `
      <div style="padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:8px;">
        <div style="font-size:13px;">${escapeHtml(r.text)}</div>
        ${r.parentTask ? `<div style="font-size:11px;color:#8a7f75;margin-top:4px;">属于：${escapeHtml(r.parentTask)}</div>` : ''}
      </div>
    `).join('');
  } else {
    listHtml = '<p style="text-align:center;color:#8a7f75;padding:20px;">今天也许是个休息日，那也没关系~</p>';
  }
  
  const overlay = createEl('div', 'modal-overlay bedtime-overlay');
  overlay.style.cssText = 'display:flex;z-index:9998;';
  
  const skipReviewBtn = bedtimeState.entryCount > 0 
    ? '<button class="action-btn secondary" onclick="skipBedtimeReview()" style="flex:1;background:transparent;border:1px solid #6a5f55;color:#8a7f75;">跳过回顾</button>'
    : '';
  
  overlay.innerHTML = `
    <div class="modal bedtime-modal" style="background:linear-gradient(180deg,#1a1520 0%,#0d0a12 100%);color:#f0e6d8;max-width:400px;position:relative;">
      <button class="bedtime-close-btn" onclick="exitBedtimeRitual()" title="退出仪式">×</button>
      <h3 style="color:#c9a87c;margin-bottom:16px;">🌙 睡前安心仪式</h3>
      <div style="font-size:12px;color:#8a7f75;margin-bottom:12px;">第 1 步 · 回顾今日</div>
      
      <p style="font-size:14px;margin-bottom:16px;color:#d4c4b0;">
        ${bedtimeState.review.length > 0 ? '你看，今天你做到了这些：' : '今天也许是个休息日，那也没关系~'}
      </p>
      
      <div style="max-height:40vh;overflow-y:auto;margin-bottom:20px;">
        ${listHtml}
      </div>
      
      <div style="display:flex;gap:8px;">
        ${skipReviewBtn}
        <button class="action-btn primary" onclick="proceedBedtimeStep(1)" style="flex:1;background:linear-gradient(135deg,#c9a87c,#8b6f5e);">继续 →</button>
      </div>
      
      <p style="font-size:11px;color:#6a5f55;text-align:center;margin-top:16px;">点击屏幕任意位置继续</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.querySelector('.bedtime-modal').onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') proceedBedtimeStep(1);
  };
  
  window._bedtimeOverlay = overlay;
}

/**
 * 跳过回顾步骤
 */
function skipBedtimeReview() {
  proceedBedtimeStep(1);
}

/**
 * 进入下一步
 * @param {number} step - 下一步编号
 */
function proceedBedtimeStep(step) {
  if (window._bedtimeOverlay) {
    window._bedtimeOverlay.remove();
    window._bedtimeOverlay = null;
  }
  showBedtimeStep(step);
}

/**
 * 第二步：三个小确幸（选择题）
 */
async function showBedtimeGratitude() {
  // 生成5个选择题选项
  const gratitudeOptions = await generateGratitudeOptions();
  
  const overlay = createEl('div', 'modal-overlay bedtime-overlay');
  overlay.style.cssText = 'display:flex;z-index:9998;';
  
  let optionsHtml = gratitudeOptions.map((opt, i) => `
    <button class="gratitude-option" data-index="${i}" onclick="toggleGratitudeOption(this, ${i})" style="
      width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
      border-radius:10px;font-size:13px;text-align:left;margin-bottom:8px;
      cursor:pointer;transition:all 0.2s;color:#d4c4b0;
    ">${escapeHtml(opt)}</button>
  `).join('');
  
  overlay.innerHTML = `
    <div class="modal bedtime-modal" style="background:linear-gradient(180deg,#1a1520 0%,#0d0a12 100%);color:#f0e6d8;max-width:400px;position:relative;">
      <button class="bedtime-close-btn" onclick="exitBedtimeRitual()" title="退出仪式">×</button>
      <h3 style="color:#c9a87c;margin-bottom:16px;">🌙 睡前安心仪式</h3>
      <div style="font-size:12px;color:#8a7f75;margin-bottom:12px;">第 2 步 · 三个小确幸</div>
      
      <p style="font-size:14px;margin-bottom:16px;color:#d4c4b0;">
        今天有哪些小小的美好？选几个吧~
      </p>
      
      <div id="gratitudeOptions" style="max-height:45vh;overflow-y:auto;margin-bottom:16px;">
        ${optionsHtml}
      </div>
      
      <div id="selectedGratitudes" style="margin-bottom:12px;font-size:12px;color:#8a7f75;"></div>
      
      <div style="display:flex;gap:8px;">
        <button class="action-btn secondary" onclick="refreshGratitudeOptions()" style="flex:1;background:transparent;border:1px solid #6a5f55;color:#8a7f75;">换一批</button>
        <button class="action-btn primary" id="confirmGratitudeBtn" onclick="confirmGratitudeSelection()" style="flex:1;background:linear-gradient(135deg,#c9a87c,#8b6f5e);" disabled>选好啦~</button>
      </div>
      
      <p style="font-size:11px;color:#6a5f55;text-align:center;margin-top:16px;">点击屏幕任意位置继续</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  overlay.querySelector('.bedtime-modal').onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') {} // 不自动继续，需要选择
  };
  
  window._bedtimeOverlay = overlay;
  window._gratitudeOptions = gratitudeOptions;
}

/**
 * 生成小确幸选项
 * @returns {Promise<string[]>} 5个小确幸选项
 */
async function generateGratitudeOptions() {
  const data = getData();
  const today = todayDateStr();
  const todayDone = data.tasks.filter(t => 
    t.status === 'done' && t.completedAt && t.completedAt.startsWith(today)
  );
  
  const prompt = SF_PROMPT.buildGratitudeOptionsPrompt(todayDone.map(t => t.text));
  
  try {
    const result = await SF_API.callAI(
      [{ role: 'user', content: prompt }],
      '你是一个温暖的陪伴者，擅长发现生活中的小美好。'
    );
    return result.split('\n').filter(l => l.trim()).slice(0, 5);
  } catch (e) {
    // 兜底选项
    return [
      '今天按时吃了饭',
      '喝了一杯好喝的东西',
      '看到了一朵好看的花',
      '和人聊了几句天',
      '安静地待了一会儿'
    ];
  }
}

/**
 * 切换小确幸选项
 * @param {HTMLElement} btn - 按钮元素
 * @param {number} index - 选项索引
 */
function toggleGratitudeOption(btn, index) {
  const options = window._gratitudeOptions;
  if (!options) return;
  
  const text = options[index];
  
  if (bedtimeState.gratitudes.includes(text)) {
    // 取消选择
    bedtimeState.gratitudes = bedtimeState.gratitudes.filter(g => g !== text);
    btn.style.background = 'rgba(255,255,255,0.05)';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
  } else {
    // 选择（不限制数量）
    bedtimeState.gratitudes.push(text);
    btn.style.background = 'rgba(201,168,124,0.15)';
    btn.style.borderColor = '#c9a87c';
  }
  
  // 更新确认按钮状态
  const confirmBtn = document.getElementById('confirmGratitudeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = bedtimeState.gratitudes.length === 0;
  }
  
  // 更新已选显示
  const selectedDiv = document.getElementById('selectedGratitudes');
  if (selectedDiv && bedtimeState.gratitudes.length > 0) {
    selectedDiv.innerHTML = '已选：' + bedtimeState.gratitudes.map(g => `"${g}"`).join('、');
  }
}

/**
 * 刷新小确幸选项
 */
async function refreshGratitudeOptions() {
  const newOptions = await generateGratitudeOptions();
  window._gratitudeOptions = newOptions;
  
  const container = document.getElementById('gratitudeOptions');
  if (!container) return;
  
  container.innerHTML = newOptions.map((opt, i) => `
    <button class="gratitude-option" data-index="${i}" onclick="toggleGratitudeOption(this, ${i})" style="
      width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
      border-radius:10px;font-size:13px;text-align:left;margin-bottom:8px;
      cursor:pointer;transition:all 0.2s;color:#d4c4b0;
    ">${escapeHtml(opt)}</button>
  `).join('');
  
  // 恢复已选状态
  container.querySelectorAll('.gratitude-option').forEach((btn, i) => {
    if (bedtimeState.gratitudes.includes(newOptions[i])) {
      btn.style.background = 'rgba(201,168,124,0.15)';
      btn.style.borderColor = '#c9a87c';
    }
  });
}

/**
 * 确认小确幸选择，进入下一步
 */
function confirmGratitudeSelection() {
  proceedBedtimeStep(2);
}

/**
 * 第三步：放下焦虑
 */
function showBedtimeAnxiety() {
  if (window._bedtimeOverlay) window._bedtimeOverlay.remove();
  
  const overlay = createEl('div', 'modal-overlay bedtime-overlay');
  overlay.style.cssText = 'display:flex;z-index:9998;';
  
  overlay.innerHTML = `
    <div class="modal bedtime-modal" style="background:linear-gradient(180deg,#1a1520 0%,#0d0a12 100%);color:#f0e6d8;max-width:400px;position:relative;">
      <button class="bedtime-close-btn" onclick="exitBedtimeRitual()" title="退出仪式">×</button>
      <h3 style="color:#c9a87c;margin-bottom:16px;">🌙 睡前安心仪式</h3>
      <div style="font-size:12px;color:#8a7f75;margin-bottom:12px;">第 3 步 · 放下焦虑</div>
      
      <p style="font-size:14px;margin-bottom:12px;color:#d4c4b0;">
        如果今天有什么还在心里放不下——一件没做完的事、一句让你不舒服的话、一个反复出现的念头——写在这里，然后我们把它放下。
      </p>
      
      <textarea id="anxietyText" class="api-input" style="min-height:100px;resize:vertical;margin-bottom:12px;background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:#f0e6d8;" placeholder="想到了就写，没想到就跳过~"></textarea>
      
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <input type="checkbox" id="saveAnxietyCheck" style="width:16px;height:16px;accent-color:#c9a87c;">
        <label for="saveAnxietyCheck" style="font-size:12px;color:#8a7f75;">保存这段话（仅你自己可见，不会发送给任何人）</label>
      </div>
      
      <div style="display:flex;gap:8px;">
        <button class="action-btn secondary" onclick="proceedBedtimeStep(1)" style="flex:1;background:transparent;border:1px solid #6a5f55;color:#8a7f75;">← 上一步</button>
        <button class="action-btn primary" onclick="submitAnxietyAndProceed()" style="flex:1;background:linear-gradient(135deg,#c9a87c,#8b6f5e);">放下 →</button>
      </div>
      
      <p style="font-size:11px;color:#6a5f55;text-align:center;margin-top:16px;">点击屏幕任意位置继续</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  
  window._bedtimeOverlay = overlay;
}

/**
 * 提交焦虑并进入下一步
 */
function submitAnxietyAndProceed() {
  const textarea = document.getElementById('anxietyText');
  const checkbox = document.getElementById('saveAnxietyCheck');
  
  if (textarea) {
    bedtimeState.anxietyText = textarea.value.trim();
    bedtimeState.anxietySaved = checkbox ? checkbox.checked : false;
    
    // 如果有内容，显示飘走动画
    if (bedtimeState.anxietyText && window._bedtimeOverlay) {
      textarea.classList.add('anxiety-fade-out');
      setTimeout(() => {
        proceedBedtimeStep(3);
      }, 1000);
    } else {
      proceedBedtimeStep(3);
    }
  } else {
    proceedBedtimeStep(3);
  }
}

/**
 * 第四步：AI晚安语
 */
async function showBedtimeGoodnight() {
  if (window._bedtimeOverlay) window._bedtimeOverlay.remove();
  
  // 生成晚安语
  const prompt = SF_PROMPT.buildGoodnightPrompt(
    bedtimeState.review,
    bedtimeState.gratitudes,
    bedtimeState.anxietySaved ? bedtimeState.anxietyText : null
  );
  
  const overlay = createEl('div', 'modal-overlay bedtime-overlay');
  overlay.style.cssText = 'display:flex;z-index:9998;';
  
  overlay.innerHTML = `
    <div class="modal bedtime-modal" style="background:linear-gradient(180deg,#1a1520 0%,#0d0a12 100%);color:#f0e6d8;max-width:400px;position:relative;">
      <button class="bedtime-close-btn" onclick="exitBedtimeRitual()" title="退出仪式">×</button>
      <h3 style="color:#c9a87c;margin-bottom:16px;">🌙 晚安</h3>
      
      <div id="goodnightLoading" style="text-align:center;padding:40px;">
        <div style="display:flex;justify-content:center;margin-bottom:12px;">${getMascotSVG(getCurrentMascot())}</div>
        <p style="font-size:13px;color:#8a7f75;">正在为你写下温柔的晚安...</p>
      </div>
      
      <div id="goodnightContent" style="display:none;">
        <div id="goodnightMessage" style="font-size:14px;line-height:1.8;color:#d4c4b0;margin-bottom:20px;"></div>
        
        <div style="display:flex;gap:8px;">
          <button class="action-btn secondary" onclick="copyGoodnightMessage()" style="flex:1;background:transparent;border:1px solid #6a5f55;color:#8a7f75;">📋 复制</button>
          <button class="action-btn primary" onclick="saveBedtimeRecord()" style="flex:1;background:linear-gradient(135deg,#c9a87c,#8b6f5e);">保存记录</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  window._bedtimeOverlay = overlay;
  
  try {
    const settings = getSettings();
    const message = await SF_API.callAI(
      [{ role: 'user', content: prompt }],
      SF_PROMPT.buildSystemPrompt('sleep_guide', settings)
    );
    
    bedtimeState.goodnightMessage = message;
    
    document.getElementById('goodnightLoading').style.display = 'none';
    document.getElementById('goodnightContent').style.display = 'block';
    document.getElementById('goodnightMessage').innerHTML = message.replace(/\n/g, '<br>');
    
  } catch (e) {
    document.getElementById('goodnightLoading').style.display = 'none';
    document.getElementById('goodnightContent').style.display = 'block';
    document.getElementById('goodnightMessage').textContent = '今天你做了很多事，辛苦了。好好休息，晚安，好梦~';
    bedtimeState.goodnightMessage = '今天你做了很多事，辛苦了。好好休息，晚安，好梦~';
  }
}

/**
 * 复制晚安语到剪贴板
 */
function copyGoodnightMessage() {
  if (bedtimeState.goodnightMessage) {
    copyToClipboard(bedtimeState.goodnightMessage);
    showToast('已复制到剪贴板', 'success');
  }
}

/**
 * 保存睡前仪式记录
 */
function saveBedtimeRecord() {
  const data = getData();
  
  const entry = {
    id: Date.now(),
    type: 'bedtime',
    date: todayDateStr(),
    timestamp: new Date().toISOString(),
    review: bedtimeState.review,
    gratitudes: bedtimeState.gratitudes,
    anxietyText: bedtimeState.anxietySaved ? bedtimeState.anxietyText : null,
    anxietySaved: bedtimeState.anxietySaved,
    goodnightMessage: bedtimeState.goodnightMessage
  };
  
  data.diary.push(entry);
  saveData(data);
  
  if (window._bedtimeOverlay) {
    window._bedtimeOverlay.remove();
    window._bedtimeOverlay = null;
  }
  
  showToast('晚安记录已保存在成长日记 📖 中~ 好梦 ✨', 'success');
  
  // 打开日记弹窗显示记录
  openDiaryModal();
}

// ===== 工具函数 =====

function createEl(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function todayDateStr() {
  const now = new Date();
  return now.getFullYear() + '-' + 
    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
    String(now.getDate()).padStart(2, '0');
}

// 添加 spinner 动画样式
const spinStyle = document.createElement('style');
spinStyle.textContent = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(spinStyle);

// 导出
window.SF_DIARY = {
  generateResponse: generateDiaryResponse,
  saveWithResponse: saveDiaryWithResponse,
  startBedtime: startBedtimeRitual,
  proceedStep: proceedBedtimeStep,
  toggleGratitude: toggleGratitudeOption,
  refreshGratitude: refreshGratitudeOptions,
  confirmGratitude: confirmGratitudeSelection,
  submitAnxiety: submitAnxietyAndProceed,
  copyGoodnight: copyGoodnightMessage,
  saveBedtime: saveBedtimeRecord,
  skipReview: skipBedtimeReview
};