const FIELD_RULES = {
  targetAmount: { label: '目标金额', min: 0, exclusiveMin: true },
  currentSavings: { label: '当前已有存款', min: 0 },
  monthlyContribution: { label: '每月计划存入金额', min: 0, exclusiveMin: true }
};

export function validateSavingsInput(input) {
  const values = {};
  const errors = {};

  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    const raw = input?.[field];
    const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
    values[field] = value;

    if (raw === undefined || raw === null || String(raw).trim() === '' || !Number.isFinite(value)) {
      errors[field] = `请输入有效的${rule.label}`;
      continue;
    }
    if (value < rule.min || (rule.exclusiveMin && value === rule.min)) {
      errors[field] = rule.exclusiveMin ? `${rule.label}必须大于${rule.min}` : `${rule.label}不能小于${rule.min}`;
    }
  }

  return { valid: Object.keys(errors).length === 0, values, errors };
}

export function calculateSavingsGoal(values, now = new Date()) {
  const remainingAmount = Math.max(values.targetAmount - values.currentSavings, 0);
  const isGoalReached = values.currentSavings >= values.targetAmount;
  const estimatedMonths = isGoalReached ? 0 : Math.ceil(remainingAmount / values.monthlyContribution);
  const years = Math.floor(estimatedMonths / 12);
  const months = estimatedMonths % 12;
  const remainingCents = Math.round(remainingAmount * 100);
  const contributionCents = Math.round(values.monthlyContribution * 100);
  const finalMonthAmount = isGoalReached ? 0 : ((remainingCents - 1) % contributionCents + 1) / 100;
  const targetDate = new Date(now.getFullYear(), now.getMonth() + estimatedMonths, 1);
  const progressPercent = Math.min(values.currentSavings / values.targetAmount * 100, 100);

  return {
    remainingAmount,
    isGoalReached,
    estimatedMonths,
    years,
    months,
    finalMonthAmount,
    targetYear: targetDate.getFullYear(),
    targetMonth: targetDate.getMonth() + 1,
    progressPercent
  };
}
