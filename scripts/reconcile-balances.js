#!/usr/bin/env node
require('dotenv').config();
const pool = require('../config/db');
// simple arg parsing: default dry-run; pass --apply to actually perform deductions
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
(async () => {
  const conn = await pool.getConnection();
  try {
  
    try {
      await conn.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS balance_deducted TINYINT(1) DEFAULT 0");
      console.log('Ensured column `balance_deducted` exists on `leaves`.');
    } catch (err) {
      
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Column `balance_deducted` already exists.');
      } else {
        // try an alternative check
        const [cols] = await conn.query("SHOW COLUMNS FROM leaves LIKE 'balance_deducted'");
        if (!cols || cols.length === 0) {
          await conn.execute('ALTER TABLE leaves ADD COLUMN balance_deducted TINYINT(1) DEFAULT 0');
          console.log('Added `balance_deducted` column.');
        }
      }
    }

    
    const [rows] = await conn.query("SELECT l.id, l.user_id, l.type, l.start_date, l.end_date, lb.id as balance_id, lb.balance as current_balance FROM leaves l LEFT JOIN leave_balances lb ON lb.user_id = l.user_id AND lb.type = l.type WHERE l.status = 'approved' AND (l.balance_deducted IS NULL OR l.balance_deducted = 0)");
    if (!rows.length) {
      console.log('No approved leaves pending deduction.');
      return;
    }

    console.log(`Found ${rows.length} approved leaves pending deduction.`);

    let applied = 0, skipped = 0;
    for (const r of rows) {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      const days = Math.ceil((end - start) / (1000*60*60*24)) + 1; // inclusive
      console.log(`Leave id=${r.id} user=${r.user_id} type=${r.type} days=${days} balance=${r.current_balance}`);

      if (!r.balance_id) {
        console.warn(`  No balance row for user ${r.user_id} type ${r.type} — skipping.`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [dry-run] Would deduct ${days} from balance_id=${r.balance_id} (current ${r.current_balance}).`);
        applied++;
        continue;
      }

      
      await conn.beginTransaction();
      try {
        const [brows] = await conn.execute('SELECT balance FROM leave_balances WHERE id = ? FOR UPDATE', [r.balance_id]);
        if (!brows.length) throw new Error('Balance row disappeared');
        const bal = parseFloat(brows[0].balance);
        if (bal < days) {
          console.warn(`  Insufficient balance (${bal}) for leave ${r.id} — skipping.`);
          await conn.rollback();
          skipped++;
          continue;
        }
        const newBal = (bal - days).toFixed(2);
        await conn.execute('UPDATE leave_balances SET balance = ? WHERE id = ?', [newBal, r.balance_id]);
        await conn.execute('UPDATE leaves SET balance_deducted = 1 WHERE id = ?', [r.id]);
        await conn.commit();
        console.log(`  Deducted ${days}. New balance ${newBal}`);
        applied++;
      } catch (err) {
        await conn.rollback();
        console.error('  Error processing leave', r.id, err.message);
        skipped++;
      }
    }

    console.log(`Summary: processed=${rows.length} applied=${applied} skipped=${skipped} (dryRun=${dryRun})`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
