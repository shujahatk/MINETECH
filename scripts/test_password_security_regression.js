import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import { validatePasswordStrength, POST as changePasswordHandler } from '../app/api/auth/change-password/route.js';
import { signToken } from '../lib/services/authService.js';

async function runPasswordSecurityTests() {
  console.log('======================================================================');
  console.log('🔐 RUNNING PASSWORD SECURITY & REGRESSION AUDIT');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  };

  // 1. Password Strength Validation Tests
  const weak1 = validatePasswordStrength('short');
  assert(!weak1.valid, 'Rejects password shorter than 8 characters');

  const weak2 = validatePasswordStrength('nouppercase123!');
  assert(!weak2.valid, 'Rejects password with no uppercase letter');

  const weak3 = validatePasswordStrength('NOLOWERCASE123!');
  assert(!weak3.valid, 'Rejects password with no lowercase letter');

  const weak4 = validatePasswordStrength('NoNumbersHere!');
  assert(!weak4.valid, 'Rejects password with no numeric digit');

  const weak5 = validatePasswordStrength('NoSpecialChar123');
  assert(!weak5.valid, 'Rejects password with no special character');

  const strong = validatePasswordStrength('SecureP@ssw0rd2026!');
  assert(strong.valid, 'Accepts strong complex password meeting all criteria');

  // 2. Integration Test with Supabase User
  const testEmail = `sec_test_${Date.now()}@example.com`;
  const initialPassword = 'InitialP@ssw0rd123!';
  const initialSalt = await bcrypt.genSalt(10);
  const initialHashed = await bcrypt.hash(initialPassword, initialSalt);

  const { data: testUser, error: createErr } = await supabaseAdmin
    .from('users')
    .insert({
      email: testEmail,
      password: initialHashed,
      name: 'Security Test Admin',
      role: 'admin',
      approved: true,
    })
    .select()
    .single();

  if (createErr || !testUser) {
    console.error('❌ [FATAL SETUP FAILURE] Failed to create test user in Supabase:', createErr?.message);
    failed++;
    console.log(`\n======================================================================`);
    console.log(`📊 PASSWORD SECURITY RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
    console.log(`======================================================================\n`);
    process.exit(1);
  }

  const userToken = signToken({
    userId: testUser.id,
    email: testUser.email,
    role: 'admin',
  });

  try {
    // 3. Reject Wrong Current Password
    const reqWrongCurrent = {
      headers: new Headers({
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json',
      }),
      json: async () => ({
        currentPassword: 'WrongPassword999!',
        newPassword: 'NewSecureP@ssw0rd2026!',
        confirmPassword: 'NewSecureP@ssw0rd2026!',
      }),
    };

    const resWrong = await changePasswordHandler(reqWrongCurrent);
    const bodyWrong = await resWrong.json();
    assert(resWrong.status === 400 && bodyWrong.message.includes('Current password is incorrect'), 'Rejects password change with incorrect current password');

    // 4. Change Password Successfully
    const newPlainPassword = 'BrandNewP@ssw0rd2026!';
    const reqValid = {
      headers: new Headers({
        authorization: `Bearer ${userToken}`,
        'content-type': 'application/json',
      }),
      json: async () => ({
        currentPassword: initialPassword,
        newPassword: newPlainPassword,
        confirmPassword: newPlainPassword,
      }),
    };

    const resValid = await changePasswordHandler(reqValid);
    const bodyValid = await resValid.json();
    assert(resValid.status === 200 && bodyValid.success, 'Allows password change with valid current password and matching new password');

    // 5. Inspect Database Row to Ensure BCrypt Hash and NO Plaintext
    const { data: updatedUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', testUser.id)
      .single();

    assert(updatedUser.password !== newPlainPassword, 'Database DOES NOT contain plaintext password');
    assert(updatedUser.password.startsWith('$2a$') || updatedUser.password.startsWith('$2b$'), 'Database stores cryptographically strong bcrypt hash');

    // 6. Verify New Hash Authenticates
    const match = await bcrypt.compare(newPlainPassword, updatedUser.password);
    assert(match === true, 'Login verification via bcrypt.compare succeeds for new password hash');

    // 7. Verify Old Password Fails
    const oldMatch = await bcrypt.compare(initialPassword, updatedUser.password);
    assert(oldMatch === false, 'Old password hash is permanently replaced and cannot authenticate');

    // 8. Verify Session Invalidation via Set-Cookie header
    const cookieHeader = resValid.headers.get('set-cookie') || '';
    assert(cookieHeader.includes('token=;') || cookieHeader.includes('Max-Age=0'), 'Invalidates auth session cookie on password change');

  } catch (err) {
    console.error('Test execution exception:', err);
    failed++;
  } finally {
    // Cleanup test user
    await supabaseAdmin.from('users').delete().eq('id', testUser.id);
  }

  console.log(`\n======================================================================`);
  console.log(`📊 PASSWORD SECURITY RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPasswordSecurityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
