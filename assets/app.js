import { calculateHourlyReturn, validateInput } from './calculator.js';
import { calculateSavingsGoal, validateSavingsInput } from './savings.js';
import { createVisitorEventClaim, getOrCreateVisitor, initializeAnalytics, loadAnalyticsConfig } from './analytics.js';

const form = document.querySelector('#calculator-form');
const savingsForm = document.querySelector('#savings-form');
const views = document.querySelectorAll('[data-view]');
const shareStatus = document.querySelector('.share-status');
const drawer = document.querySelector('#tool-drawer');
const drawerBackdrop = document.querySelector('#drawer-backdrop');
const drawerOpeners = document.querySelectorAll('[data-action="drawer-open"]');
let drawerOpener = null;
const description = document.querySelector('meta[name="description"]');
const hourlySeo = {
  title: '打工人真实时薪计算器',
  description: '在当前设备浏览器内算一算你的每小时综合投入回报。'
};
const savingsSeo = {
  title: '存钱目标计算器',
  description: '存钱目标计算器：算一算多久能存够钱，每月存多少钱能实现目标。'
};
let lastResult = null;
let lastValues = null;
const visitor = getOrCreateVisitor();
const visitorEventClaim = createVisitorEventClaim(undefined, visitor.visitorId);
const analyticsReady = loadAnalyticsConfig().then(initializeAnalytics);

analyticsReady.then((analytics) => {
  if (visitorEventClaim.shouldTrack) {
    analytics.track('calculator_visitor', { onDelivered: visitorEventClaim.confirmDelivered });
  }
});

function trackAnalyticsEvent(eventName) {
  analyticsReady.then((analytics) => analytics.track(eventName));
}

function setDrawerCurrentTool(viewName) {
  const tool = viewName.startsWith('savings') ? 'savings' : 'hourly';
  document.querySelectorAll('[data-drawer-tool]').forEach((button) => {
    const current = button.dataset.drawerTool === tool;
    button.classList.toggle('is-current', current);
    if (current) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

function openDrawer(opener) {
  drawerOpener = opener;
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  drawerBackdrop.hidden = false;
  document.body.classList.add('drawer-open');
  drawerOpeners.forEach((button) => button.setAttribute('aria-expanded', 'true'));
  drawer.querySelector('.drawer-tool.is-current')?.focus();
}

function closeDrawer({ restoreFocus = true } = {}) {
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawerBackdrop.hidden = true;
  document.body.classList.remove('drawer-open');
  drawerOpeners.forEach((button) => button.setAttribute('aria-expanded', 'false'));
  if (restoreFocus) drawerOpener?.focus();
}

setDrawerCurrentTool('home');

function showView(name) {
  views.forEach((view) => {
    const active = view.dataset.view === name;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  });
  const seo = name.startsWith('savings') ? savingsSeo : hourlySeo;
  document.title = seo.title;
  description.setAttribute('content', seo.description);
  setDrawerCurrentTool(name);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function formatMoney(value) {
  return `¥${value.toFixed(2)}`;
}

function formatTime(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPercent(value) {
  return `${formatTime(value)}%`;
}

function messageFor(rate) {
  if (rate < 10) return '这组数字提醒你：把时间和成本算清楚，也是在为自己多留一份选择。';
  if (rate < 20) return '你已经把时间成本一起算进来了，这会让未来的判断更踏实。';
  if (rate < 40) return '从这组数据看，你的每小时投入有不错的回报，继续按自己的节奏走。';
  return '从这组数据看，你的每小时投入回报较高，也别忘了照顾好自己的生活节奏。';
}

function setResult(name, value) {
  document.querySelectorAll(`[data-result="${name}"]`).forEach((element) => {
    element.textContent = value;
  });
}

function setSavingsResult(name, value) {
  document.querySelectorAll(`[data-savings-result="${name}"]`).forEach((element) => {
    element.textContent = value;
  });
}

function renderResults(values, result) {
  setResult('comprehensiveHourlyRate', formatMoney(result.comprehensiveHourlyRate));
  setResult('comprehensiveHourlyRateCopy', `${formatMoney(result.comprehensiveHourlyRate)} / 小时`);
  setResult('comprehensiveHourlyRateSmall', `${formatMoney(result.comprehensiveHourlyRate)}/小时`);
  setResult('monthlyIncome', `${formatMoney(values.monthlyIncome)}/月`);
  setResult('monthlyWorkHours', `${formatTime(result.monthlyWorkHours)} 小时/月`);
  setResult('monthlyCommuteHours', `${formatTime(result.monthlyCommuteHours)} 小时/月`);
  setResult('monthlyTotalHours', `${formatTime(result.monthlyTotalHours)} 小时/月`);
  setResult('monthlyWorkCost', `${formatMoney(result.monthlyWorkCost)}/月`);
  setResult('nominalHourlyRate', `${formatMoney(result.nominalHourlyRate)}/小时`);
  setResult('annualTotalHours', formatTime(result.annualTotalHours));
  setResult('equivalentDays', formatTime(result.equivalentDays));
  setResult('equivalentDaysCopy', formatTime(result.equivalentDays));
  setResult('message', messageFor(result.comprehensiveHourlyRate));
}

function renderSavingsResults(values, result) {
  const progressPercent = formatPercent(result.progressPercent);
  const hero = document.querySelector('.savings-hero-result');
  const complete = document.querySelector('[data-savings-complete]');
  const progress = document.querySelector('[data-savings-progress]');
  const progressbar = document.querySelector('[role="progressbar"]');

  hero.hidden = result.isGoalReached;
  complete.hidden = !result.isGoalReached;
  setSavingsResult('remainingAmount', formatMoney(result.remainingAmount));
  setSavingsResult('summary', `按照每月存 ${formatMoney(values.monthlyContribution)} 的计划，预计需要 ${result.estimatedMonths} 个月。`);
  setSavingsResult('currentSavings', formatMoney(values.currentSavings));
  setSavingsResult('targetAmount', formatMoney(values.targetAmount));
  setSavingsResult('progressPercent', progressPercent);
  setSavingsResult('progressPercentCopy', progressPercent);
  setSavingsResult('estimatedMonths', result.isGoalReached ? '已完成' : `${result.estimatedMonths} 个月`);
  setSavingsResult('duration', `${result.years} 年 ${result.months} 个月`);
  setSavingsResult('targetDate', result.isGoalReached ? '现在' : `${result.targetYear} 年 ${String(result.targetMonth).padStart(2, '0')} 月`);
  setSavingsResult('finalMonthAmount', result.isGoalReached ? '已完成' : formatMoney(result.finalMonthAmount));
  progress.style.width = `${result.progressPercent}%`;
  progressbar.setAttribute('aria-valuenow', String(result.progressPercent));
}

function clearErrors() {
  form.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
  form.querySelectorAll('[data-error-for]').forEach((element) => { element.textContent = ''; });
}

function renderErrors(errors) {
  clearErrors();
  Object.entries(errors).forEach(([name, message]) => {
    const input = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);
    input.closest('.field').classList.add('has-error');
    error.textContent = message;
  });
  const firstError = form.querySelector('.has-error input');
  if (firstError) firstError.focus();
}

function clearSavingsErrors() {
  savingsForm.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
  savingsForm.querySelectorAll('[data-savings-error-for]').forEach((element) => { element.textContent = ''; });
}

function renderSavingsErrors(errors, shouldFocus = false) {
  clearSavingsErrors();
  Object.entries(errors).forEach(([name, message]) => {
    const input = savingsForm.elements[name];
    const error = savingsForm.querySelector(`[data-savings-error-for="${name}"]`);
    input.closest('.field').classList.add('has-error');
    error.textContent = message;
  });
  if (shouldFocus) {
    const firstError = savingsForm.querySelector('.has-error input');
    if (firstError) firstError.focus();
  }
}

function updateSavingsPreview() {
  const rawValues = Object.fromEntries(new FormData(savingsForm).entries());
  const validation = validateSavingsInput(rawValues);
  if (!validation.valid) {
    renderSavingsErrors(validation.errors);
    return null;
  }
  clearSavingsErrors();
  const result = calculateSavingsGoal(validation.values);
  renderSavingsResults(validation.values, result);
  return { values: validation.values, result };
}

function buildShareText() {
  return `我用打工人真实时薪计算器算了一下：按我的填写情况估算，每小时综合回报约为 ${formatMoney(lastResult.comprehensiveHourlyRate)}。把时间、通勤和成本一起算清楚，多一份参考。`;
}

async function shareResult() {
  if (!lastResult) return;
  const text = buildShareText();
  if (navigator.share) {
    try {
      await navigator.share({ title: '我的每小时综合回报参考', text });
      shareStatus.textContent = '已打开分享面板。';
      trackAnalyticsEvent('calculator_share');
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporaryInput = document.createElement('textarea');
      temporaryInput.value = text;
      temporaryInput.setAttribute('readonly', '');
      temporaryInput.style.position = 'fixed';
      temporaryInput.style.opacity = '0';
      document.body.append(temporaryInput);
      temporaryInput.select();
      const copied = document.execCommand('copy');
      temporaryInput.remove();
      if (!copied) throw new Error('Copy command was not accepted');
    }
    shareStatus.textContent = '结果文案已复制，可以去分享给朋友。';
    trackAnalyticsEvent('calculator_copy');
  } catch {
    shareStatus.textContent = '复制没有完成，请长按结果文字后手动复制。';
  }
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'drawer-open') {
      openDrawer(button);
      return;
    }
    if (action === 'drawer-close') {
      closeDrawer();
      return;
    }
    if (action === 'start' || action === 'form' || action === 'hourly-form') {
      if ((action === 'form' || action === 'hourly-form') && lastResult) trackAnalyticsEvent('calculator_reset');
      showView('form');
      if (button.closest('#tool-drawer')) closeDrawer({ restoreFocus: false });
    }
    if (action === 'savings-form') {
      showView('savings-form');
      if (button.closest('#tool-drawer')) closeDrawer({ restoreFocus: false });
    }
    if (action === 'home') showView('home');
    if (action === 'share') shareResult();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const rawValues = Object.fromEntries(new FormData(form).entries());
  const validation = validateInput(rawValues);
  if (!validation.valid) {
    renderErrors(validation.errors);
    return;
  }
  clearErrors();
  lastValues = validation.values;
  lastResult = calculateHourlyReturn(lastValues);
  renderResults(lastValues, lastResult);
  shareStatus.textContent = '';
  trackAnalyticsEvent('calculator_used');
  showView('results');
});

savingsForm.addEventListener('input', updateSavingsPreview);

savingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const preview = updateSavingsPreview();
  if (!preview) {
    const firstError = savingsForm.querySelector('.has-error input');
    if (firstError) firstError.focus();
    return;
  }
  showView('savings-results');
});
