
/**
 * Dashboard & Analytics Service
 * All aggregation and summary logic lives here, keeping controllers thin.
 */
const { getDatabase } = require('../config/database');
const { ROLES } = require('../config/constants');

/**
 * Resolve the userId filter based on the requesting user's role.
 * Admins see all data (returns null = no filter).
 * All other roles see only their own data.
 */
function resolveUserScope(requestingUser) {
  return requestingUser.role === ROLES.ADMIN ? null : requestingUser.id;
}

function getSummary({ startDate, endDate, userId } = {}) {
  const db = getDatabase();
  const conditions = ['is_deleted = 0'];
  const params = [];

  if (startDate) { conditions.push('date >= ?'); params.push(startDate); }
  if (endDate)   { conditions.push('date <= ?'); params.push(endDate); }
  if (userId)    { conditions.push('user_id = ?'); params.push(userId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
      COUNT(*) AS total_records,
      COUNT(CASE WHEN type = 'income'  THEN 1 END) AS income_count,
      COUNT(CASE WHEN type = 'expense' THEN 1 END) AS expense_count,
      MIN(date) AS earliest_date,
      MAX(date) AS latest_date
    FROM financial_records
    ${where}
  `).get(...params);

  return {
    totalIncome:    round(row.total_income),
    totalExpenses:  round(row.total_expenses),
    netBalance:     round(row.total_income - row.total_expenses),
    totalRecords:   row.total_records,
    incomeCount:    row.income_count,
    expenseCount:   row.expense_count,
    earliestDate:   row.earliest_date,
    latestDate:     row.latest_date,
  };
}

function getCategoryBreakdown({ startDate, endDate, userId, type } = {}) {
  const db = getDatabase();
  const conditions = ['is_deleted = 0'];
  const params = [];

  if (startDate) { conditions.push('date >= ?');   params.push(startDate); }
  if (endDate)   { conditions.push('date <= ?');   params.push(endDate); }
  if (userId)    { conditions.push('user_id = ?'); params.push(userId); }
  if (type)      { conditions.push('type = ?');    params.push(type); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db.prepare(`
    SELECT
      category, type,
      COUNT(*) as count,
      ROUND(SUM(amount), 2)  as total,
      ROUND(AVG(amount), 2)  as average,
      ROUND(MIN(amount), 2)  as min_amount,
      ROUND(MAX(amount), 2)  as max_amount
    FROM financial_records
    ${where}
    GROUP BY category, type
    ORDER BY total DESC
  `).all(...params);

  const categoryMap = {};
  for (const row of rows) {
    if (!categoryMap[row.category]) {
      categoryMap[row.category] = { category: row.category, income: null, expense: null };
    }
    categoryMap[row.category][row.type] = {
      total: row.total, count: row.count,
      average: row.average, min: row.min_amount, max: row.max_amount,
    };
  }

  return Object.values(categoryMap).sort((a, b) => {
    const aTotal = (a.income?.total || 0) + (a.expense?.total || 0);
    const bTotal = (b.income?.total || 0) + (b.expense?.total || 0);
    return bTotal - aTotal;
  });
}

function getMonthlyTrends({ months = 12, userId } = {}) {
  const db = getDatabase();
  const conditions = [
    'is_deleted = 0',
    `date >= date('now', '-${parseInt(months, 10)} months')`,
  ];
  const params = [];
  if (userId) { conditions.push('user_id = ?'); params.push(userId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      ROUND(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 2) AS income,
      ROUND(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 2) AS expense,
      COUNT(*) AS total_transactions
    FROM financial_records
    ${where}
    GROUP BY month
    ORDER BY month ASC
  `).all(...params);

  return rows.map(r => ({
    month: r.month,
    income: r.income,
    expense: r.expense,
    netBalance: round(r.income - r.expense),
    totalTransactions: r.total_transactions,
  }));
}

/**
 * Weekly trends for the past N weeks.
 *
 * NOTE: SQLite's %W (Sunday-based week number) produces week "00" for days
 * before the first Monday of the year. We add 1 when the year starts on
 * Sunday (%w = 0) to align with ISO-8601 convention used by charting libs.
 */
function getWeeklyTrends({ weeks = 8, userId } = {}) {
  const db = getDatabase();
  const conditions = [
    'is_deleted = 0',
    `date >= date('now', '-${parseInt(weeks, 10) * 7} days')`,
  ];
  const params = [];
  if (userId) { conditions.push('user_id = ?'); params.push(userId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db.prepare(`
    SELECT
      strftime('%Y', date) || '-W' ||
        printf('%02d',
          CAST(strftime('%W', date) AS INTEGER) +
          CASE WHEN strftime('%w', strftime('%Y', date) || '-01-01') = '0' THEN 1 ELSE 0 END
        ) AS week,
      ROUND(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 2) AS income,
      ROUND(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 2) AS expense,
      COUNT(*) AS total_transactions
    FROM financial_records
    ${where}
    GROUP BY week
    ORDER BY week ASC
  `).all(...params);

  return rows.map(r => ({
    week: r.week,
    income: r.income,
    expense: r.expense,
    netBalance: round(r.income - r.expense),
    totalTransactions: r.total_transactions,
  }));
}

function getRecentActivity({ limit = 10, userId } = {}) {
  const db = getDatabase();
  const conditions = ['r.is_deleted = 0'];
  const params = [];
  if (userId) { conditions.push('r.user_id = ?'); params.push(userId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  return db.prepare(`
    SELECT r.id, r.amount, r.type, r.category, r.date, r.description,
           u.name AS created_by
    FROM financial_records r
    LEFT JOIN users u ON r.user_id = u.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(...params, Math.min(parseInt(limit, 10) || 10, 50));
}

function getTopCategories({ limit = 5, startDate, endDate, userId } = {}) {
  const db = getDatabase();
  const conditions = ["is_deleted = 0", "type = 'expense'"];
  const params = [];

  if (startDate) { conditions.push('date >= ?');   params.push(startDate); }
  if (endDate)   { conditions.push('date <= ?');   params.push(endDate); }
  if (userId)    { conditions.push('user_id = ?'); params.push(userId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  return db.prepare(`
    SELECT category,
           COUNT(*) AS count,
           ROUND(SUM(amount), 2) AS total,
           ROUND(AVG(amount), 2) AS average
    FROM financial_records
    ${where}
    GROUP BY category
    ORDER BY total DESC
    LIMIT ?
  `).all(...params, Math.min(parseInt(limit, 10) || 5, 20));
}

function getDailyAverages({ startDate, endDate, userId } = {}) {
  const db = getDatabase();
  const conditions = ['is_deleted = 0'];
  const params = [];

  if (startDate) { conditions.push('date >= ?');   params.push(startDate); }
  if (endDate)   { conditions.push('date <= ?');   params.push(endDate); }
  if (userId)    { conditions.push('user_id = ?'); params.push(userId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const row = db.prepare(`
    SELECT
      ROUND(AVG(CASE WHEN type = 'income'  THEN daily_income  ELSE NULL END), 2) AS avg_daily_income,
      ROUND(AVG(CASE WHEN type = 'expense' THEN daily_expense ELSE NULL END), 2) AS avg_daily_expense
    FROM (
      SELECT date,
        SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS daily_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS daily_expense,
        type
      FROM financial_records
      ${where}
      GROUP BY date, type
    )
  `).get(...params);

  return {
    avgDailyIncome:  row?.avg_daily_income  || 0,
    avgDailyExpense: row?.avg_daily_expense || 0,
  };
}

function getDashboardOverview(params = {}) {
  return {
    summary:           getSummary(params),
    categoryBreakdown: getCategoryBreakdown(params),
    monthlyTrends:     getMonthlyTrends({ months: 6, userId: params.userId }),
    topCategories:     getTopCategories({ limit: 5, ...params }),
    recentActivity:    getRecentActivity({ limit: 5, userId: params.userId }),
    dailyAverages:     getDailyAverages(params),
  };
}

function round(n, decimals = 2) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

module.exports = {
  resolveUserScope,
  getSummary,
  getCategoryBreakdown,
  getMonthlyTrends,
  getWeeklyTrends,
  getRecentActivity,
  getTopCategories,
  getDailyAverages,
  getDashboardOverview,
};