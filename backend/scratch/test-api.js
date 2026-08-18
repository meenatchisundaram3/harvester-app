import { initDb, query, execute } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function runTests() {
  console.log('=============================================');
  console.log(' Starting Backend API & DB Verification Test');
  console.log('=============================================');

  try {
    // 1. Initialize DB
    await initDb();
    console.log('✔ Database initialized successfully.');

    // 2. Query Owner Table
    const owners = await query('SELECT * FROM owner WHERE username = ?', ['owner']);
    if (owners.length > 0) {
      console.log('✔ Owner record seeded successfully:', owners[0].username);
      
      // 3. Test Password Comparison
      const isMatch = await bcrypt.compare('ownerpassword123', owners[0].password_hash);
      console.log(`✔ Password verification check: ${isMatch ? 'PASS' : 'FAIL'}`);
      
      if (!isMatch) {
        throw new Error('Hashed password does not match default password.');
      }
    } else {
      throw new Error('Owner record was not seeded.');
    }

    // 4. Test JWT Signing
    const testSecret = process.env.JWT_SECRET || 'super_secret_harvester_key_2026';
    const payload = { id: 1, username: 'owner' };
    const token = jwt.sign(payload, testSecret, { expiresIn: '1h' });
    console.log('✔ JWT Token signed successfully.');

    const decoded = jwt.verify(token, testSecret);
    if (decoded.username === 'owner') {
      console.log('✔ JWT Token verified successfully.');
    } else {
      throw new Error('Decoded JWT payload mismatch.');
    }

    // 5. Test writing a dummy operator and fetching it
    console.log('Testing operators table CRUD...');
    const dummyOpId = 'test-op-123';
    await execute('DELETE FROM operators WHERE id = ?', [dummyOpId]);
    
    await execute(
      'INSERT INTO operators (id, name, mobile, salary_type, salary_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [dummyOpId, 'Test Operator', '9876543210', 'Monthly', 15000.00, 'Active']
    );
    console.log('✔ Dummy operator inserted successfully.');

    const ops = await query('SELECT * FROM operators WHERE id = ?', [dummyOpId]);
    if (ops.length > 0 && ops[0].name === 'Test Operator') {
      console.log('✔ Operator query verify: PASS');
    } else {
      throw new Error('Failed to query back inserted operator.');
    }

    await execute('DELETE FROM operators WHERE id = ?', [dummyOpId]);
    console.log('✔ Dummy operator deleted successfully.');

    console.log('\n=============================================');
    console.log(' ALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('=============================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
