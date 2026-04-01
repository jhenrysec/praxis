import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { query, closePool } from '../src/db/pool.js';

const BCRYPT_ROUNDS = 12;

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Create default admin account
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!@#';
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  await query(
    `INSERT INTO users (email, username, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, $4, 'admin', 'active')
     ON CONFLICT (email) DO NOTHING`,
    ['admin@lab.local', 'admin', passwordHash, 'Lab Administrator'],
  );

  // Verify 20 lab slots exist (migration 003 pre-populates them)
  const slots = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM lab_slots');
  const slotCount = parseInt(slots[0]?.count ?? '0', 10);

  if (slotCount < 20) {
    console.log(`[seed] only ${slotCount} slots found — inserting missing slots`);
    for (let i = 1; i <= 20; i++) {
      await query(
        'INSERT INTO lab_slots (slot_number) VALUES ($1) ON CONFLICT (slot_number) DO NOTHING',
        [i],
      );
    }
  }

  console.log('Seed complete');
  console.log(`  Admin account: admin@lab.local / ${adminPassword}`);
  console.log('  Change this password immediately after first login!');
  console.log(`  Lab slots: 20`);

  await closePool();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
