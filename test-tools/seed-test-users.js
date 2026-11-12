/**
 * Create or reset test users for trying the AI APIs.
 *
 *   node test-tools/seed-test-users.js            # random password, 100 credits
 *   TEST_USER_PASSWORD=... TEST_USER_CREDITS=50 node test-tools/seed-test-users.js
 *
 * Idempotent: re-running resets the same two users (password, credits, verified),
 * and touches no other user. Reads MONGO_URI from .env.
 */
'use strict';

const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.loadEnvFile(path.join(__dirname, '..', '.env'));

const BCRYPT_ROUNDS = 10; // same as src/core/constants BCRYPT_ROUNDS
const password = process.env.TEST_USER_PASSWORD || `Test-${crypto.randomBytes(6).toString('hex')}`;
const credits = Number(process.env.TEST_USER_CREDITS || 100);

const USERS = [
  { name: 'Test Tenant', companyName: 'Test Tenant Co', email: 'test.tenant@visionitforme.test', role: 'TENANT' },
  { name: 'Test Landlord', companyName: 'Test Landlord Co', email: 'test.landlord@visionitforme.test', role: 'LANDLORD' },
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');
  if (password.length < 6) throw new Error('TEST_USER_PASSWORD must be at least 6 characters');
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection('users');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date();

  for (const user of USERS) {
    const result = await users.updateOne(
      { email: user.email },
      {
        $set: {
          ...user,
          password: hash,
          isVerified: true,
          isSuspended: false,
          creditBalance: credits,
          updatedAt: now,
        },
        $setOnInsert: {
          gender: 'male',
          bio: '',
          profileImage: '',
          multiProfileImage: [],
          pdfFile: '',
          address: {},
          otpVerified: false,
          hasActiveSubscription: false,
          blockedUsers: [],
          language: 'en',
          createdAt: now,
          __v: 0,
        },
      },
      { upsert: true },
    );
    console.log(`${result.upsertedCount ? 'created' : 'reset  '} ${user.role.padEnd(8)} ${user.email}`);
  }
  console.log(`\npassword: ${password}\ncredits:  ${credits} each`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
