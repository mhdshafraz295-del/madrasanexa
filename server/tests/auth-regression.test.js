import http from 'http';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';

async function testAuthRegression() {
  console.log('Testing Auth Regression (Login & /me)...');
  let testServer = null;

  try {
    // 1. Seed or ensure Super Admin exists in isolated test DB
    const email = 'superadmin@madrasanexa.com';
    const password = 'SuperSecureAdmin#2026';
    const passwordHash = await hashPassword(password);

    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true, role: 'SUPER_ADMIN', mustChangePassword: false },
      create: {
        name: 'Super Admin Regression Tester',
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        mustChangePassword: false,
      },
    });

    // 2. Start ephemeral test HTTP server
    await new Promise((resolve) => {
      testServer = http.createServer(app);
      testServer.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });

    const port = testServer.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api`;

    // 3. Test POST /api/auth/login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const loginJson = await loginRes.json();
    console.log('Login Status:', loginRes.status);
    console.log('Login Success:', loginJson.success);
    console.log('Role:', loginJson.data?.user?.role);

    if (!loginJson.success || !loginJson.data?.accessToken) {
      console.error('Login failed! Response:', loginJson);
      process.exit(1);
    }

    // 4. Test GET /api/auth/me
    const token = loginJson.data.accessToken;
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: 'Bearer ' + token },
    });

    const meJson = await meRes.json();
    console.log('/me Status:', meRes.status);
    console.log('/me Success:', meJson.success);
    console.log('/me User:', meJson.data?.user?.email);

    if (meRes.status === 200 && meJson.success && meJson.data?.user?.email === email) {
      console.log('✅ Auth regression verification PASSED!');
    } else {
      console.error('❌ /me verification failed:', meJson);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Unexpected error in auth regression test:', err);
    process.exit(1);
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await prisma.$disconnect();
  }
}

testAuthRegression();
