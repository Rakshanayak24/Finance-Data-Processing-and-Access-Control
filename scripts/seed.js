/**
 * Database Seed Script
 * Creates test users and realistic financial records for all roles.
 *
 * Usage: node scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initializeDatabase, getDatabase, closeDatabase } = require('../src/config/database');

const BCRYPT_ROUNDS = 10; // Faster for seeding

const SEED_USERS = [
  { name: 'Alice Admin',   email: 'admin@example.com',   password: 'Admin@1234',   role: 'admin' },
  { name: 'Ana Analyst',   email: 'analyst@example.com', password: 'Analyst@1234', role: 'analyst' },
  { name: 'Victor Viewer', email: 'viewer@example.com',  password: 'Viewer@1234',  role: 'viewer' },
];

const CATEGORIES = ['salary', 'freelance', 'food', 'transport', 'utilities', 'entertainment', 'shopping', 'healthcare', 'investment', 'other'];
const INCOME_CATEGORIES = ['salary', 'freelance', 'investment'];
const EXPENSE_CATEGORIES = ['food', 'transport', 'utilities', 'entertainment', 'shopping', 'healthcare', 'other'];

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(monthsBack) {
  const now = new Date();
  const past = new Date();
  past.setMonth(past.getMonth() - monthsBack);
  const diff = now.getTime() - past.getTime();
  return new Date(past.getTime() + Math.random() * diff).toISOString().slice(0, 10);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DESCRIPTIONS = {
  salary: 'Monthly salary deposit',
  freelance: 'Freelance project payment',
  investment: 'Stock dividend / returns',
  food: ['Grocery run', 'Restaurant dinner', 'Coffee shop', 'Meal delivery', 'Lunch at office'],
  transport: ['Uber ride', 'Monthly bus pass', 'Fuel top-up', 'Parking fee', 'Auto rickshaw'],
  utilities: ['Electricity bill', 'Internet plan', 'Water bill', 'Mobile recharge', 'Gas cylinder'],
  entertainment: ['Netflix subscription', 'Movie tickets', 'Spotify premium', 'Gaming purchase'],
  shopping: ['Amazon order', 'Clothing purchase', 'Electronics', 'Home appliance'],
  healthcare: ['Pharmacy', 'Doctor consultation', 'Health insurance premium', 'Lab tests'],
  other: ['Miscellaneous expense', 'ATM withdrawal', 'Bank charges'],
};

async function seed() {
  initializeDatabase();
  const db = getDatabase();

  // Clear existing seed data (idempotent)
  const emails = SEED_USERS.map(u => u.email);
  const placeholders = emails.map(() => '?').join(',');
  const existingUsers = db.prepare(`SELECT id FROM users WHERE email IN (${placeholders})`).all(...emails);
  if (existingUsers.length > 0) {
    const ids = existingUsers.map(u => u.id);
    ids.forEach(id => {
      db.prepare('DELETE FROM financial_records WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    console.log('Cleared existing seed data.');
  }

  // Create users
  const createdUsers = [];
  for (const u of SEED_USERS) {
    const id = uuidv4();
    const hashed = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    db.prepare(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, u.name, u.email, hashed, u.role);
    createdUsers.push({ ...u, id });
    console.log(`✓ Created ${u.role}: ${u.email} / ${u.password}`);
  }

  // Seed 200 financial records spread over 12 months
  const insertRecord = db.prepare(`
    INSERT INTO financial_records (id, user_id, amount, type, category, date, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records) => {
    for (const r of records) insertRecord.run(...r);
  });

  const records = [];
  for (let i = 0; i < 200; i++) {
    const user = randomItem(createdUsers);
    const type = Math.random() > 0.45 ? 'expense' : 'income';
    const category = type === 'income' ? randomItem(INCOME_CATEGORIES) : randomItem(EXPENSE_CATEGORIES);

    const amount = type === 'income'
      ? (category === 'salary' ? randomBetween(50000, 120000) : randomBetween(5000, 40000))
      : randomBetween(100, 8000);

    const descPool = DESCRIPTIONS[category];
    const description = Array.isArray(descPool) ? randomItem(descPool) : descPool;
    const tags = JSON.stringify([type, category]);

    records.push([uuidv4(), user.id, amount, type, category, randomDate(12), description, tags]);
  }

  insertMany(records);
  console.log(`✓ Seeded ${records.length} financial records.`);

  closeDatabase();
  console.log('\n✅ Seeding complete! Start the server with: npm start');
  console.log('\nTest credentials:');
  SEED_USERS.forEach(u => console.log(`  ${u.role.padEnd(8)} → ${u.email} / ${u.password}`));
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
