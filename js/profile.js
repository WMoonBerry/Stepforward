// ============================================================
// StepForward · 用户行为画像系统 v1.0
// ============================================================
// 通过 localStorage 追踪用户行为模式（拖延倾向、情绪触发等），
// 生成用户画像注入 AI prompt，实现"越用越懂你"。
// 数据仅存统计摘要，不存原始对话内容。
// ============================================================

const PROFILE_KEY = 'stepforward_profile';

/**
 * 创建默认的用户画像
 * @returns {Object} 默认画像对象
 */
function createDefaultProfile() {
  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    behavior: {
      tasks: {
        totalCreated: 0,
        totalCompleted: 0,
        averageCompletionRate: 0,
        completionRateTrend: 'stable',
        averageStepsPerTask: 0,
        mostProductiveHour: null,
      },
      procrastination: {
        averageDelayMinutes: 0,
        delayTriggerKeywords: [],
        totalDelayedTasks: 0,
      },
      emotions: {
        levelDistribution: { level1: 0, level2: 0, level3: 0, level4: 0 },
        commonTriggers: [],
        averageRecoveryRounds: 0,
        effectiveInterventions: [],
      },
    },
    recentContext: {
      dailySummaries: [],
      streakDays: 0,
      lastActiveDate: null,
    },
  };
}

/**
 * 获取用户画像
 * @returns {Object} 画像对象
 */
function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return createDefaultProfile();
    const profile = JSON.parse(raw);
    // 简单的版本兼容检查
    if (!profile.version) return createDefaultProfile();
    return profile;
  } catch (e) {
    console.warn('[getProfile] 读取失败，返回默认值:', e);
    return createDefaultProfile();
  }
}

/**
 * 保存用户画像
 * @param {Object} profile - 画像对象
 */
function saveProfile(profile) {
  profile.updatedAt = new Date().toISOString();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/**
 * 更新今日摘要
 * @param {Object} profile - 画像对象
 * @param {string} field - 要更新的字段
 * @param {*} value - 值（数字则累加）
 */
function updateTodaySummary(profile, field, value) {
  const today = new Date().toISOString().slice(0, 10);
  let summary = profile.recentContext.dailySummaries.find(s => s.date === today);
  if (!summary) {
    summary = { date: today, tasksCompleted: 0, tasksCreated: 0, emotionPeaks: [], mainTopics: [] };
    profile.recentContext.dailySummaries.push(summary);
    // 最多保留30天
    if (profile.recentContext.dailySummaries.length > 30) {
      profile.recentContext.dailySummaries.shift();
    }
  }
  if (typeof value === 'number') {
    summary[field] = (summary[field] || 0) + value;
  } else if (Array.isArray(summary[field])) {
    summary[field].push(value);
  }
}

/**
 * 更新活跃时段
 * @param {Object} profile - 画像对象
 */
function updateActiveHour(profile) {
  const hour = new Date().getHours();
  if (!profile.behavior.tasks.activeHours) profile.behavior.tasks.activeHours = {};
  profile.behavior.tasks.activeHours[hour] = (profile.behavior.tasks.activeHours[hour] || 0) + 1;
  // 找出最活跃时段
  let maxCount = 0;
  let maxHour = null;
  for (const [h, c] of Object.entries(profile.behavior.tasks.activeHours)) {
    if (c > maxCount) { maxCount = c; maxHour = parseInt(h); }
  }
  profile.behavior.tasks.mostProductiveHour = maxHour;
}

/**
 * 追踪任务创建
 * @param {Object} task - 创建的任务对象
 */
function trackTaskCreated(task) {
  try {
    const profile = getProfile();
    profile.behavior.tasks.totalCreated++;
    updateTodaySummary(profile, 'tasksCreated', 1);
    updateActiveHour(profile);
    saveProfile(profile);
    console.log('[trackTaskCreated] 画像已更新');
  } catch (e) { console.warn('[trackTaskCreated] 失败:', e); }
}

/**
 * 追踪任务完成
 * @param {Object} task - 完成的任务对象
 * @param {number} delayMinutes - 拖延时长（分钟，0表示未拖延）
 */
function trackTaskCompleted(task, delayMinutes) {
  try {
    const profile = getProfile();
    const tasks = profile.behavior.tasks;
    tasks.totalCompleted++;
    // 完成率
    if (tasks.totalCreated > 0) {
      tasks.averageCompletionRate = tasks.totalCompleted / tasks.totalCreated;
    }
    // 拖延统计
    if (delayMinutes > 15) {
      const procras = profile.behavior.procrastination;
      procras.totalDelayedTasks++;
      procras.averageDelayMinutes = Math.round(
        (procras.averageDelayMinutes * (procras.totalDelayedTasks - 1) + delayMinutes) / procras.totalDelayedTasks
      );
    }
    updateTodaySummary(profile, 'tasksCompleted', 1);
    updateActiveHour(profile);
    saveProfile(profile);
    console.log('[trackTaskCompleted] 画像已更新，完成率:', tasks.averageCompletionRate);
  } catch (e) { console.warn('[trackTaskCompleted] 失败:', e); }
}

/**
 * 追踪情绪事件
 * @param {number} emotionLevel - 情绪等级 1-4
 * @param {string} triggerContext - 触发上下文（用户输入的文本摘要）
 */
function trackEmotionEvent(emotionLevel, triggerContext) {
  try {
    const profile = getProfile();
    const emotions = profile.behavior.emotions;
    const levelKey = 'level' + emotionLevel;
    emotions.levelDistribution[levelKey] = (emotions.levelDistribution[levelKey] || 0) + 1;
    // 记录触发词（简单提取关键词）
    if (triggerContext && triggerContext.length > 2) {
      const trigger = triggerContext.slice(0, 20);
      if (!emotions.commonTriggers.includes(trigger)) {
        emotions.commonTriggers.push(trigger);
        if (emotions.commonTriggers.length > 10) emotions.commonTriggers.shift();
      }
    }
    updateTodaySummary(profile, 'emotionPeaks', emotionLevel);
    saveProfile(profile);
    console.log('[trackEmotionEvent] 画像已更新，等级:', emotionLevel);
  } catch (e) { console.warn('[trackEmotionEvent] 失败:', e); }
}

/**
 * 生成注入 AI prompt 的用户画像文本
 * @returns {string} 画像摘要文本（数据不足时返回空字符串）
 */
function generateAIContext() {
  try {
    const profile = getProfile();
    const tasks = profile.behavior.tasks;
    const emotions = profile.behavior.emotions;
    const procras = profile.behavior.procrastination;
    const parts = [];

    // 任务模式（需要至少10个任务才有参考价值）
    if (tasks.totalCompleted >= 5) {
      const rate = Math.round(tasks.averageCompletionRate * 100);
      parts.push(`用户已完成 ${tasks.totalCompleted} 个任务，完成率约 ${rate}%。`);
    }

    // 拖延模式
    if (procras.totalDelayedTasks >= 3) {
      parts.push(`用户平均拖延约 ${procras.averageDelayMinutes} 分钟才开始任务，有时会在任务开头卡住，但一旦启动通常能顺利完成。`);
    }

    // 情绪模式
    const totalEmotions = Object.values(emotions.levelDistribution).reduce((a, b) => a + b, 0);
    if (totalEmotions >= 3) {
      const level3plus = (emotions.levelDistribution.level3 || 0) + (emotions.levelDistribution.level4 || 0);
      if (level3plus > 0) {
        parts.push(`用户偶尔会出现较强烈的情绪波动，情绪触发阈值较低，容易因为外界刺激陷入低谷。`);
      }
      const level1 = emotions.levelDistribution.level1 || 0;
      if (level1 > totalEmotions * 0.5) {
        parts.push(`用户大多数时候情绪状态较好，轻微的不适通常能自我调节。`);
      }
    }

    // 最有效时段
    if (tasks.mostProductiveHour !== null) {
      parts.push(`用户最高效的时间段大约在 ${tasks.mostProductiveHour}:00 左右。`);
    }

    // 数据不足时不注入
    const context = parts.join('\n');
    if (context.length < 50) return '';

    return `\n---\n## 用户行为画像（自动生成，帮助你更好地理解用户）\n${context}\n\n注意：请根据以上画像自然地调整你的回应方式，但不要直接提及"你的数据显示"之类的表述。`;
  } catch (e) {
    console.warn('[generateAIContext] 失败:', e);
    return '';
  }
}

// ===== 导出 =====
window.SF_PROFILE = {
  getProfile,
  saveProfile,
  trackTaskCreated,
  trackTaskCompleted,
  trackEmotionEvent,
  generateAIContext,
};
