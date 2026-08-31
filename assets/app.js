import { calculateHourlyReturn, validateInput } from './calculator.js';
import { initializeAnalytics } from './analytics.js';
import { analyticsConfig } from './analytics-config.js';

const form = document.querySelector('#calculator-form');
const views = document.querySelectorAll('[data-view]');
const shareStatus = document.querySelector('.share-status');
let lastResult = null;
let lastValues = null;
const analytics = initializeAnalytics(analyticsConfig);

function showView(name) {
  views.forEach((view) => {
    const active = view.dataset.view === name;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function formatMoney(value) {
  return `¥${value.toFixed(2)}`;
}

function formatTime(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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
      analytics.track('calculator_share');
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
    analytics.track('calculator_copy');
  } catch {
    shareStatus.textContent = '复制没有完成，请长按结果文字后手动复制。';
  }
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'start' || action === 'form') {
      if (action === 'form' && lastResult) analytics.track('calculator_reset');
      showView('form');
    }
    if (action === 'home') showView('home');
    if (action === 'share') shareResult();
  });
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
  analytics.track('calculator_used');
  showView('results');
});
