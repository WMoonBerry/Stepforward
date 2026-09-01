/**
 * StepForward - 用户引导模块 v2.1
 * 实现轻量开屏 + 事件驱动式导览混合方案
 *
 * v2.1 更新（修复页面冻结 + 引导中断）：
 *   1. 修复跳过循环 bug：循环内每轮重新读取 TOUR_STEPS[index]
 *   2. 目标元素暂未出现时（如 #previewSection 等待 AI 返回）进入"等待模式"：
 *      每 500ms 轮询、最多 60 秒；出现则显示该步，超时跳过；
 *      期间收到 tour:taskFailed 则结束引导并提示可从设置重新查看
 *   3. 幽灵模式（trigger 步骤 + 等待期间）：遮罩不拦截点击、隐藏黑幕，
 *      用户可正常操作真实界面；气泡本身保持可点击（跳过按钮可用）
 *   4. 高亮重做：
 *      - 交互步骤：.tour-highlight-live（仅 outline 脉冲，不改布局、不挡点击）
 *      - 纯讲解步骤：.tour-spotlight 聚光灯挖洞，不再给真实元素加破坏布局的类
 *   5. 移除"点击高亮元素前进"的旧监听（与新设计冲突）
 */

// 引导状态管理
const ONBOARDING_KEY = 'sf_onboarding_state';

// 等待模式参数
const TOUR_WAIT_POLL_MS = 500;    // 轮询间隔
const TOUR_WAIT_MAX_MS = 60000;   // 最长等待 60 秒

// 导览步骤配置（trigger 字段支持事件驱动）
const TOUR_STEPS = [
  {
    target: '.input-box',
    title: '在这里告诉我你想做什么',
    content: '我来帮你拆分成不可能完不成的小步骤。\n试着输入一个任务，点击 → 提交',
    position: 'top',
    trigger: 'taskSubmit',      // 触发条件：用户提交任务
    prefill: '写项目周报 +下午3点前交'
  },
  {
    target: '#previewSection',
    title: '看，我把大任务变成了小步骤~',
    content: '相信我，很容易就能完成的！\n点击「就按这个办」开始吧~',
    position: 'top',
    trigger: 'taskConfirm',     // 触发条件：用户确认任务
    waitText: '正在拆解任务，稍等一下…'   // 目标未出现时的等待文案
  },
  {
    target: '#nextTaskContainer',
    title: '这里有本次待办步骤的提示卡片',
    content: '做的时候专注这个任务就好啦！\n完成后点击 ✓ 标记完成~',
    position: 'top',
    trigger: 'taskAction'       // 触发条件：完成任务或暂停
  },
  {
    target: '#nextTaskContainer',
    title: '做得好！',
    content: '如果临时有事或做不动了，也不用有压力，点「等一下」，不论发生了什么我都一直陪着你。',
    position: 'top'
    // 无 trigger，传统步骤
  },
  {
    target: '#pendingBtn',
    title: '点击这里查看目前已安排的任务哦~',
    content: '',
    position: 'bottom'
  },
  {
    target: '#doneBtn',
    title: '这是完成后的任务集合',
    content: '里面的每一个步骤都是勋章，哪怕再微小，都是你勇敢前行的证明~请常回来看看哦！',
    position: 'bottom'
  },
  {
    target: '#diaryBtn',
    title: '📖 成长日记',
    content: '你完成的任务、写下的日记、睡前仪式的记录，都在这里哦~ 当你在这里记录下生活的每个瞬间，我都会立刻给你回应。但如果你希望自己静静记录就好，也可以在设置⚙里关闭回应~',
    position: 'bottom'
  },
  {
    target: '#bedtimeFloatBall',
    title: '🌙 睡前安心仪式',
    content: '当你结束了一天的辛苦工作，睡前可以点击这里，我来陪伴你安心入睡。点击有惊喜！还可以在设置⚙里开启每日固定提醒哦~',
    position: 'left'
  },
  {
    target: '#settingsBtn',
    title: '在这里调整我对你的称呼、工作时间、提醒强度、外观模式',
    content: '所有的功能都可以在这里设置——让我更贴心地为你服务~',
    position: 'bottom'
  },
  {
    target: null,
    title: '我的功能都介绍完毕啦',
    content: '如果你还想再回顾，随时可以在 ⚙️ 设置里重新查看引导哦，接下来让我和你一起向前走吧~',
    position: 'center'
  }
];

let currentTourStep = 0;

// ===== 公共函数（提取避免冗余）=====

/**
 * 隐藏导览遮罩层，并清理所有引导附加状态
 */
function hideTourOverlay() {
  clearWaitMode();
  clearFailedListener();
  removeSpotlight();
  // 清理拖动事件监听，防止内存泄漏
  if (_tourDragCleanup) {
    _tourDragCleanup();
    _tourDragCleanup = null;
  }
  const overlay = document.getElementById('tourOverlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('ghost', 'spotlight-mode');
    document.querySelectorAll('.tour-highlight-live, .tour-highlight-dashed').forEach(el => {
      el.classList.remove('tour-highlight-live', 'tour-highlight-dashed');
    });
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  }, 300);
}

/**
 * 将气泡定位到屏幕中央
 * @param {HTMLElement} tooltip - 气泡元素
 */
function positionTooltipCenter(tooltip) {
  if (!tooltip) return;
  tooltip.style.left = '50%';
  tooltip.style.top = '50%';
  tooltip.style.transform = 'translate(-50%, -50%)';
  tooltip.classList.add('center');
}

/**
 * 初始化引导系统
 */
function initOnboarding() {
  const state = getOnboardingState();

  // 首次进入显示开屏页
  if (!state.hasSeenWelcome) {
    showWelcomeScreen();
  }

  // 绑定导览控制事件
  bindTourEvents();
}

/**
 * 获取引导状态
 */
function getOnboardingState() {
  try {
    const saved = localStorage.getItem(ONBOARDING_KEY);
    return saved ? JSON.parse(saved) : {
      hasSeenWelcome: false,
      hasCompletedTour: false,
      currentStep: 0
    };
  } catch (e) {
    return {
      hasSeenWelcome: false,
      hasCompletedTour: false,
      currentStep: 0
    };
  }
}

/**
 * 保存引导状态
 */
function saveOnboardingState(state) {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[Onboarding] 保存状态失败:', e);
  }
}

/**
 * 显示开屏欢迎页
 */
function showWelcomeScreen() {
  const welcomeOverlay = document.getElementById('welcomeOverlay');
  if (welcomeOverlay) {
    welcomeOverlay.style.display = 'flex';
    setTimeout(() => welcomeOverlay.classList.add('show'), 10);
  }
}

/**
 * 隐藏开屏欢迎页
 */
function hideWelcomeScreen() {
  const welcomeOverlay = document.getElementById('welcomeOverlay');
  if (welcomeOverlay) {
    welcomeOverlay.classList.remove('show');
    setTimeout(() => {
      welcomeOverlay.style.display = 'none';
      // 标记已看过开屏
      const state = getOnboardingState();
      state.hasSeenWelcome = true;
      saveOnboardingState(state);
      // 开始导览
      startTour();
    }, 300);
  }
}

/**
 * 开始导览
 */
function startTour() {
  currentTourStep = 0;
  const state = getOnboardingState();

  // 如果已完成导览，不再显示
  if (state.hasCompletedTour) return;

  showTourStep(currentTourStep);
}

/**
 * 显示指定步骤
 * 修复：跳过循环内每轮重新读取 TOUR_STEPS[index]，
 * 避免旧实现中 step 为 const 永不更新导致"一步缺失、后续全跳"的 bug
 */
function showTourStep(index) {
  // 进入新步骤前清理等待状态与聚光灯
  clearWaitMode();
  clearFailedListener();
  removeSpotlight();

  while (index >= 0 && index < TOUR_STEPS.length) {
    const step = TOUR_STEPS[index]; // 每轮重新读取
    if (!step) break;

    const isCenter = !step.target || step.position === 'center';
    const targetExists = !step.target || !!document.querySelector(step.target);

    if (isCenter || targetExists) {
      // 可渲染的步骤
      currentTourStep = index;
      renderStep(index);
      return;
    }

    // 目标元素暂不存在
    if (step.trigger || step.waitText) {
      // 事件驱动步骤的目标可能稍后出现（如 #previewSection 等 AI 返回）→ 等待模式
      currentTourStep = index;
      enterWaitMode(index);
      return;
    }

    // 不会出现 → 跳过该步
    console.log('[Onboarding] 目标元素不存在，跳过步骤:', step.target);
    index++;
  }

  // 越过最后一步 → 完成引导
  completeTour();
}

/**
 * 渲染并显示指定步骤（目标元素已确认存在）
 */
function renderStep(index) {
  const step = TOUR_STEPS[index];
  if (!step) return;
  currentTourStep = index;

  const overlay = document.getElementById('tourOverlay');
  const tooltip = document.getElementById('tourTooltip');
  const stepNum = document.getElementById('tourStepNum');
  const stepTotal = document.getElementById('tourStepTotal');
  const title = document.getElementById('tourTooltipTitle');
  const content = document.getElementById('tourTooltipContent');
  const prevBtn = document.getElementById('tourPrevBtn');
  const nextBtn = document.getElementById('tourNextBtn');

  if (!overlay || !tooltip) return;

  // 更新步骤计数
  if (stepNum) stepNum.textContent = index + 1;
  if (stepTotal) stepTotal.textContent = TOUR_STEPS.length;

  // 更新内容
  if (title) title.textContent = step.title;
  if (content) content.innerHTML = (step.content || '').replace(/\n/g, '<br>');

  // 回退按钮显示控制
  if (prevBtn) prevBtn.style.display = index > 0 ? 'inline-block' : 'none';

  // ===== 模式选择：前4步幽灵模式（虚线高亮、不变暗），第5步起聚光灯 =====
  if (index < 4) {
    // 前4步：幽灵模式，虚线高亮，用户可正常操作
    if (step.trigger) {
      if (nextBtn) nextBtn.style.display = 'none';
      waitForTrigger(step.trigger, () => nextTourStep());
    } else {
      if (nextBtn) nextBtn.style.display = 'inline-block';
      clearTriggerListener();
    }
    setOverlayMode('ghost');
  } else {
    // 第5步起：聚光灯模式
    if (step.trigger) {
      if (nextBtn) nextBtn.style.display = 'none';
      setOverlayMode('ghost');
      waitForTrigger(step.trigger, () => nextTourStep());
    } else {
      if (nextBtn) nextBtn.style.display = 'inline-block';
      clearTriggerListener();
      setOverlayMode(step.target ? 'spotlight' : 'mask');
    }
  }

  // 先滚动高亮目标（即时滚动，确保位置计算准确）
  highlightTarget(step.target, step);

  // 定位气泡（智能定位）
  positionTooltipSmart(step, tooltip);

  // 启用拖动（标题栏可拖，支持鼠标+触摸，有边界限制）
  makeTooltipDraggable(tooltip);

  // 显示遮罩
  overlay.style.display = 'block';
  setTimeout(() => overlay.classList.add('show'), 10);

  // 如果有预填内容，预填输入框
  if (step.prefill && index === 0) {
    const input = document.getElementById('taskInput');
    if (input) {
      input.value = step.prefill;
      input.focus();
    }
  }
}

/**
 * 等待模式：目标元素暂未出现时，轮询等待其出现
 * 期间处于幽灵模式，用户可正常操作页面
 * @param {number} index - 步骤索引
 */
function enterWaitMode(index) {
  const step = TOUR_STEPS[index];
  if (!step) return;

  const overlay = document.getElementById('tourOverlay');
  const tooltip = document.getElementById('tourTooltip');
  const stepNum = document.getElementById('tourStepNum');
  const stepTotal = document.getElementById('tourStepTotal');
  const title = document.getElementById('tourTooltipTitle');
  const content = document.getElementById('tourTooltipContent');
  const prevBtn = document.getElementById('tourPrevBtn');
  const nextBtn = document.getElementById('tourNextBtn');

  if (!overlay || !tooltip) return;

  // 幽灵模式：不挡操作、隐藏黑幕
  setOverlayMode('ghost');

  if (stepNum) stepNum.textContent = index + 1;
  if (stepTotal) stepTotal.textContent = TOUR_STEPS.length;
  if (title) title.textContent = step.title;
  if (content) content.innerHTML = (step.waitText || '稍等一下…').replace(/\n/g, '<br>');
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';

  // 目标尚未出现，气泡居中显示
  positionTooltipCenter(tooltip);

  overlay.style.display = 'block';
  setTimeout(() => overlay.classList.add('show'), 10);

  // 轮询等待目标出现
  clearWaitMode();
  window._tourWaitTimer = setInterval(() => {
    if (step.target && document.querySelector(step.target)) {
      clearWaitMode();
      clearFailedListener();
      renderStep(index);
    }
  }, TOUR_WAIT_POLL_MS);

  // 超时兜底：跳过该步，绝不卡死
  window._tourWaitTimeout = setTimeout(() => {
    clearWaitMode();
    clearFailedListener();
    console.log('[Onboarding] 等待超时，跳过步骤:', step.target);
    showTourStep(index + 1);
  }, TOUR_WAIT_MAX_MS);

  // 拆解失败 → 优雅结束引导
  clearFailedListener();
  window._tourFailedListener = () => {
    clearWaitMode();
    clearFailedListener();
    console.log('[Onboarding] 任务拆解失败，引导优雅退出');
    hideTourOverlay();
    const state = getOnboardingState();
    state.hasCompletedTour = true;
    saveOnboardingState(state);
    if (typeof showToast === 'function') {
      showToast('这次拆解没有成功，引导先暂停一下~ 随时可以在 ⚙️ 设置里重新查看引导', 'info');
    }
  };
  document.addEventListener('tour:taskFailed', window._tourFailedListener, { once: true });
}

/**
 * 清理等待模式的定时器
 */
function clearWaitMode() {
  if (window._tourWaitTimer) {
    clearInterval(window._tourWaitTimer);
    window._tourWaitTimer = null;
  }
  if (window._tourWaitTimeout) {
    clearTimeout(window._tourWaitTimeout);
    window._tourWaitTimeout = null;
  }
}

/**
 * 清理 tour:taskFailed 监听器
 */
function clearFailedListener() {
  if (window._tourFailedListener) {
    try {
      document.removeEventListener('tour:taskFailed', window._tourFailedListener);
    } catch (e) {}
    window._tourFailedListener = null;
  }
}

/**
 * 设置遮罩显示模式
 * @param {string} mode - 'ghost'（幽灵：不挡点击、无黑幕）| 'spotlight'（聚光灯挖洞）| 'mask'（普通黑幕）
 */
function setOverlayMode(mode) {
  const overlay = document.getElementById('tourOverlay');
  const mask = document.querySelector('.tour-mask');
  if (!overlay) return;
  overlay.classList.remove('ghost', 'spotlight-mode');
  if (mask) mask.style.background = '';
  if (mode === 'ghost') {
    overlay.classList.add('ghost');
  } else if (mode === 'spotlight') {
    // 黑幕变透明（仍作为点击捕获层），由聚光灯负责"挖洞"视觉效果
    overlay.classList.add('spotlight-mode');
    if (mask) mask.style.background = 'transparent';
  }
  // 'mask'：保持默认黑幕
}

/**
 * 注册一次性事件监听，等待用户完成特定操作
 * @param {string} triggerType - 触发类型：taskSubmit | taskConfirm | taskAction
 * @param {Function} callback - 触发后的回调
 */
function waitForTrigger(triggerType, callback) {
  // 先清除旧监听器
  clearTriggerListener();

  const eventName = {
    taskSubmit: 'tour:taskSubmitted',
    taskConfirm: 'tour:taskConfirmed',
    taskAction: 'tour:taskCompleted'
  }[triggerType];

  if (!eventName) return;

  // 存储监听器引用，便于取消
  const wrappedCallback = () => {
    clearTriggerListener();
    callback();
  };

  window._tourTriggerListener = { eventName, callback: wrappedCallback };
  document.addEventListener(eventName, wrappedCallback, { once: true });
}

/**
 * 清除触发器监听器
 */
function clearTriggerListener() {
  if (window._tourTriggerListener) {
    try {
      document.removeEventListener(
        window._tourTriggerListener.eventName,
        window._tourTriggerListener.callback
      );
    } catch (e) {}
    window._tourTriggerListener = null;
  }
}

/**
 * 智能定位气泡：根据目标元素周围空间自动选择最佳位置
 * @param {Object} step - 步骤配置
 * @param {HTMLElement} tooltip - 气泡元素
 */
function positionTooltipSmart(step, tooltip) {
  if (!tooltip) return;

  // 收尾步骤居中显示
  if (!step.target || step.position === 'center') {
    positionTooltipCenter(tooltip);
    return;
  }

  const target = document.querySelector(step.target);
  if (!target) {
    positionTooltipCenter(tooltip);
    return;
  }

  tooltip.classList.remove('center');

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const padding = 15;

  // 计算四个方向的可用空间
  const spaces = {
    top: targetRect.top - tooltipRect.height - padding,
    bottom: window.innerHeight - targetRect.bottom - tooltipRect.height - padding,
    left: targetRect.left - tooltipRect.width - padding,
    right: window.innerWidth - targetRect.right - tooltipRect.width - padding
  };

  // 如果指定位置空间不足，自动选择最佳位置
  let bestPosition = step.position;
  const preferredSpace = spaces[step.position];

  if (preferredSpace < 0) {
    // 找出所有有足够空间的方向，选择空间最大的
    const validPositions = Object.entries(spaces)
      .filter(([_, space]) => space >= 0)
      .sort((a, b) => b[1] - a[1]);

    if (validPositions.length > 0) {
      bestPosition = validPositions[0][0];
    }
  }

  // 使用最佳位置定位
  positionAtDirection(bestPosition, targetRect, tooltip, padding);
}

/**
 * 按指定方向定位气泡
 * @param {string} position - 位置方向：top | bottom | left | right
 * @param {DOMRect} targetRect - 目标元素位置
 * @param {HTMLElement} tooltip - 气泡元素
 * @param {number} padding - 间距
 */
function positionAtDirection(position, targetRect, tooltip, padding) {
  let left, top;

  switch (position) {
    case 'top':
      left = targetRect.left + targetRect.width / 2;
      top = targetRect.top - padding - 10;
      tooltip.style.transform = 'translate(-50%, -100%)';
      break;
    case 'bottom':
      left = targetRect.left + targetRect.width / 2;
      top = targetRect.bottom + padding;
      tooltip.style.transform = 'translate(-50%, 0)';
      break;
    case 'left':
      left = targetRect.left - padding;
      top = targetRect.top + targetRect.height / 2;
      tooltip.style.transform = 'translate(-100%, -50%)';
      break;
    case 'right':
      left = targetRect.right + padding;
      top = targetRect.top + targetRect.height / 2;
      tooltip.style.transform = 'translate(0, -50%)';
      break;
    default:
      left = targetRect.left + targetRect.width / 2;
      top = targetRect.bottom + padding;
      tooltip.style.transform = 'translate(-50%, 0)';
  }

  // 边界处理
  const tooltipRect = tooltip.getBoundingClientRect();
  const maxX = window.innerWidth - tooltipRect.width - 20;
  const maxY = window.innerHeight - tooltipRect.height - 20;

  if (left < 20) left = 20;
  if (left > maxX) left = maxX;
  if (top < 20) top = 20;
  if (top > maxY) top = maxY;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

// 拖动清理函数（全局，防止重复绑定）
let _tourDragCleanup = null;

/**
 * 让引导气泡支持鼠标/触摸拖动
 * - 拖动区域：整个气泡（按钮区除外）
 * - 移动阈值：5px，低于阈值不视为拖动，防误触
 * - 边界：限制在视口内（至少留 10px）
 * - cleanup 机制：每次调用先清理旧绑定，再创建新的
 * @param {HTMLElement} tooltip - 气泡元素
 */
function makeTooltipDraggable(tooltip) {
  if (!tooltip) return;

  // 先清理旧绑定（防重复）
  if (_tourDragCleanup) {
    _tourDragCleanup();
    _tourDragCleanup = null;
  }

  const DRAG_THRESHOLD = 5;
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const getEventPoint = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  // 检查是否点在按钮/交互元素上（这些区域不触发拖动）
  const isInteractive = (target) => {
    return !!(target.closest('button') || target.closest('a') || target.closest('.tour-controls'));
  };

  const onStart = (e) => {
    if (isInteractive(e.target)) return;
    isDragging = true;
    hasMoved = false;
    const point = getEventPoint(e);
    startX = point.x;
    startY = point.y;
    const rect = tooltip.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    tooltip.classList.add('dragging');
    tooltip.style.transform = 'none';
    // 绑定全局移动/结束事件
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    e.preventDefault();
  };

  const moveTooltip = (clientX, clientY) => {
    const dx = clientX - startX;
    const dy = clientY - startY;
    // 低于阈值不视为拖动
    if (!hasMoved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    hasMoved = true;

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    // 边界限制（实时获取尺寸）
    const rect = tooltip.getBoundingClientRect();
    const margin = 10;
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;
    newLeft = Math.max(margin, Math.min(newLeft, maxLeft));
    newTop = Math.max(margin, Math.min(newTop, maxTop));

    tooltip.style.left = newLeft + 'px';
    tooltip.style.top = newTop + 'px';
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    moveTooltip(e.clientX, e.clientY);
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    const point = getEventPoint(e);
    moveTooltip(point.x, point.y);
    e.preventDefault(); // 防止页面滚动
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    tooltip.classList.remove('dragging');
    // 解绑全局事件
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onEnd);
    // 拖动后阻止一次 click，防止误触发
    if (hasMoved) {
      const preventClick = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        tooltip.removeEventListener('click', preventClick);
      };
      tooltip.addEventListener('click', preventClick, { once: true });
    }
  };

  // 绑定开始事件到整个气泡
  tooltip.addEventListener('mousedown', onStart);
  tooltip.addEventListener('touchstart', onStart, { passive: false });

  // resize 时如果气泡跑出屏幕，拉回边界内
  const onResize = () => {
    const rect = tooltip.getBoundingClientRect();
    const margin = 10;
    let changed = false;
    let newLeft = rect.left;
    let newTop = rect.top;
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;
    if (newLeft < margin) { newLeft = margin; changed = true; }
    if (newLeft > maxLeft) { newLeft = maxLeft; changed = true; }
    if (newTop < margin) { newTop = margin; changed = true; }
    if (newTop > maxTop) { newTop = maxTop; changed = true; }
    if (changed) {
      tooltip.style.left = newLeft + 'px';
      tooltip.style.top = newTop + 'px';
    }
  };
  window.addEventListener('resize', onResize);

  // 保存清理函数
  _tourDragCleanup = () => {
    tooltip.removeEventListener('mousedown', onStart);
    tooltip.removeEventListener('touchstart', onStart);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onEnd);
    window.removeEventListener('resize', onResize);
    isDragging = false;
    hasMoved = false;
  };
}

/**
 * 高亮目标元素
 * - 前4步（索引 < 4）：虚线转动动效，不变暗
 * - 第4步（索引 3）：特殊处理，只高亮"等一下"按钮
 * - 第5步起（索引 >= 4）：聚光灯挖洞
 * @param {string} selector - 目标选择器
 * @param {Object} step - 步骤配置
 */
function highlightTarget(selector, step) {
  // 移除之前的高亮与聚光灯
  document.querySelectorAll('.tour-highlight-live, .tour-highlight-dashed').forEach(el => {
    el.classList.remove('tour-highlight-live', 'tour-highlight-dashed');
  });
  removeSpotlight();

  if (!selector) return;

  // 第4步（索引3）特殊：只高亮"等一下"按钮
  let targetSelector = selector;
  if (currentTourStep === 3) {
    targetSelector = '#nextTaskContainer .action-btn.secondary';
  }

  const target = document.querySelector(targetSelector);
  if (!target) return;

  target.scrollIntoView({ behavior: 'auto', block: 'center' });

  // 前4步用虚线转动动效，第5步起用聚光灯
  if (currentTourStep < 4) {
    target.classList.add('tour-highlight-dashed');
  } else {
    createSpotlight(target);
  }
}

/**
 * 在遮罩内创建聚光灯（box-shadow 挖洞效果）
 * @param {HTMLElement} target - 目标元素
 */
function createSpotlight(target) {
  removeSpotlight();
  const overlay = document.getElementById('tourOverlay');
  if (!overlay) return;

  const spot = document.createElement('div');
  spot.className = 'tour-spotlight';
  overlay.appendChild(spot);

  const position = () => {
    if (!spot.isConnected || !target.isConnected) return;
    const rect = target.getBoundingClientRect();
    const pad = 6;
    spot.style.width = (rect.width + pad * 2) + 'px';
    spot.style.height = (rect.height + pad * 2) + 'px';
    spot.style.left = (rect.left - pad) + 'px';
    spot.style.top = (rect.top - pad) + 'px';
  };

  position();
  // 平滑滚动结束后再校准一次
  setTimeout(position, 350);

  window._tourSpotlightHandlers = { position };
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
}

/**
 * 移除聚光灯及其事件监听
 */
function removeSpotlight() {
  document.querySelectorAll('.tour-spotlight').forEach(el => el.remove());
  if (window._tourSpotlightHandlers) {
    try {
      window.removeEventListener('scroll', window._tourSpotlightHandlers.position, true);
      window.removeEventListener('resize', window._tourSpotlightHandlers.position);
    } catch (e) {}
    window._tourSpotlightHandlers = null;
  }
}

/**
 * 下一步
 */
function nextTourStep() {
  // 清除可能存在的触发器监听
  clearTriggerListener();

  currentTourStep++;

  if (currentTourStep >= TOUR_STEPS.length) {
    completeTour();
  } else {
    showTourStep(currentTourStep);
  }
}

/**
 * 上一步
 * 特殊处理：从第3步（索引2）回退 → 直接跳到第1步（索引0）
 * 原因：第2步依赖任务拆解预览，回退后不存在
 */
function prevTourStep() {
  // 清除可能存在的触发器监听
  clearTriggerListener();

  if (currentTourStep > 0) {
    // 从第3步回退 → 直接跳到第1步（第2步依赖任务拆解预览，回退后不存在）
    if (currentTourStep === 2) {
      currentTourStep = 0;
    } else {
      currentTourStep--;
    }
    showTourStep(currentTourStep);
  }
}

/**
 * 跳过导览
 */
function skipTour() {
  hideTourOverlay();
  completeTour();
}

/**
 * 完成导览
 */
function completeTour() {
  hideTourOverlay();

  // 保存完成状态
  const state = getOnboardingState();
  state.hasCompletedTour = true;
  state.currentStep = 0;
  saveOnboardingState(state);
}

/**
 * 重新开始导览（从设置触发）
 */
function restartTour() {
  const state = getOnboardingState();
  state.hasCompletedTour = false;
  state.currentStep = 0;
  saveOnboardingState(state);

  currentTourStep = 0;
  showTourStep(0);
}

/**
 * 绑定导览事件
 */
function bindTourEvents() {
  // 开屏页开始按钮
  const welcomeStartBtn = document.getElementById('welcomeStartBtn');
  if (welcomeStartBtn) {
    welcomeStartBtn.onclick = hideWelcomeScreen;
  }

  // 导览控制按钮
  const prevBtn = document.getElementById('tourPrevBtn');
  const nextBtn = document.getElementById('tourNextBtn');
  const skipBtn = document.getElementById('tourSkipBtn');

  if (prevBtn) prevBtn.onclick = prevTourStep;
  if (nextBtn) nextBtn.onclick = nextTourStep;
  if (skipBtn) skipBtn.onclick = skipTour;

  // 键盘控制
  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('tourOverlay');
    if (overlay && overlay.style.display !== 'none') {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        // 只有在非 trigger 步骤时才响应
        const currentStep = TOUR_STEPS[currentTourStep];
        if (!currentStep || !currentStep.trigger) {
          nextTourStep();
        }
      } else if (e.key === 'ArrowLeft' && currentTourStep > 0) {
        prevTourStep();
      }
    }
  });

  // 注意：v2.1 移除了"点击高亮元素前进"的旧监听——
  // 交互步骤改由真实业务事件（tour:taskSubmitted 等）驱动，
  // 旧监听会与用户真实操作冲突
}

/**
 * 处理话筒图标点击
 */
function handleMicClick() {
  showToast('语音功能开发中，敬请期待~', 'info');
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'info') {
  // 复用已有的消息提示系统
  if (typeof showMessage === 'function') {
    showMessage(message, type);
  } else {
    // 简单的 alert 兜底
    alert(message);
  }
}

// 导出函数供其他模块调用
window.initOnboarding = initOnboarding;
window.restartTour = restartTour;
window.handleMicClick = handleMicClick;
