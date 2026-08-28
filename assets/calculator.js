const FIELD_RULES = {
  monthlyIncome: {
    label: '月收入', min: 0, max: 100000
  },
  workDays: {
    label: '每月工作天数', min: 1, max: 31, integer: true
  },
  dailyWorkHours: {
    label: '每天工作时长', min: 1, max: 24
  },
  dailyCommuteHours: {
    label: '每天通勤时间', min: 0, max: 10
  },
  dailyWorkExpense: {
    label: '每天工作相关支出', min: 0
  },
  monthlyHousingCost: {
    label: '每月住宿成本', min: 0
  }
};

// All values use one monthly accounting basis so the hourly rates remain comparable.
export function calculateHourlyReturn(values) {
  // monthlyWorkHours = workDays * dailyWorkHours
  const monthlyWorkHours = values.workDays * values.dailyWorkHours;
  // monthlyCommuteHours = workDays * dailyCommuteHours
  const monthlyCommuteHours = values.workDays * values.dailyCommuteHours;
  // monthlyTotalHours = monthlyWorkHours + monthlyCommuteHours
  const monthlyTotalHours = monthlyWorkHours + monthlyCommuteHours;
  // monthlyRelatedExpense = dailyWorkExpense * workDays
  const monthlyRelatedExpense = values.dailyWorkExpense * values.workDays;
  // monthlyWorkCost = monthlyRelatedExpense + monthlyHousingCost
  const monthlyWorkCost = monthlyRelatedExpense + values.monthlyHousingCost;
  // nominalHourlyRate = monthlyIncome / monthlyWorkHours
  const nominalHourlyRate = monthlyWorkHours === 0 ? 0 : values.monthlyIncome / monthlyWorkHours;
  // netMonthlyIncome = monthlyIncome - monthlyWorkCost
  const netMonthlyIncome = values.monthlyIncome - monthlyWorkCost;
  // comprehensiveHourlyRate = netMonthlyIncome / monthlyTotalHours
  const comprehensiveHourlyRate = monthlyTotalHours === 0 ? 0 : netMonthlyIncome / monthlyTotalHours;
  // annualTotalHours = monthlyTotalHours * 12
  const annualTotalHours = monthlyTotalHours * 12;
  // equivalentDays = annualTotalHours / 24
  const equivalentDays = annualTotalHours / 24;

  return {
    monthlyWorkHours,
    monthlyCommuteHours,
    monthlyTotalHours,
    monthlyRelatedExpense,
    monthlyWorkCost,
    nominalHourlyRate,
    netMonthlyIncome,
    comprehensiveHourlyRate,
    annualTotalHours,
    equivalentDays
  };
}

export function validateInput(input) {
  const values = {};
  const errors = {};

  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    const raw = input?.[field];
    const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
    values[field] = value;

    if (raw === undefined || raw === null || String(raw).trim() === '' || !Number.isFinite(value)) {
      errors[field] = `请输入${rule.label}`;
      continue;
    }
    if (rule.integer && !Number.isInteger(value)) {
      errors[field] = `${rule.label}需为整数`;
      continue;
    }
    if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
      const range = rule.max === undefined ? `不小于${rule.min}` : `${rule.min}-${rule.max}`;
      errors[field] = `${rule.label}应在${range}之间`;
    }
  }

  return { valid: Object.keys(errors).length === 0, values, errors };
}
