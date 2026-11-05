import './setup-test-env.js';
import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { prisma } from '../src/lib/prisma.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import {
  encryptCredential,
  decryptCredential,
  validatePublicSmtpHost,
  resolveEmailSenderForMadrasa,
} from '../src/services/email-sender-resolver.service.js';
import {
  clearTestEmails,
  getTestEmails,
  enableTestMode,
  sendUstadhSalaryPaidEmail,
  sendUstadhDirectEmail,
  sendStudentFeePaymentEmail,
  sendStaffTimetableEmail,
  sendApprovalEmail,
} from '../src/services/email.service.js';

function makeRequest(app, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          let bodyJson = null;
          try {
            bodyJson = JSON.parse(data);
          } catch (_) {
            bodyJson = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: bodyJson,
          });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
}

describe('Madrasa Email Sender Settings Suite', () => {
  let madrasaA, madrasaB;
  let adminA, adminB;
  let tokenA, tokenB;

  beforeEach(async () => {
    enableTestMode(true);
    clearTestEmails();

    // Clean test records
    await prisma.madrasaEmailSetting.deleteMany({});
    await prisma.subscription.deleteMany({
      where: { madrasa: { code: { in: ['TEST_MAIL_A', 'TEST_MAIL_B'] } } },
    });
    await prisma.activityLog.deleteMany({
      where: { action: { in: ['MADRASA_EMAIL_SETTINGS_UPDATED', 'MADRASA_EMAIL_SMTP_VERIFIED', 'MADRASA_EMAIL_SMTP_VERIFICATION_FAILED'] } },
    });
    await prisma.user.deleteMany({ where: { email: { in: ['admin_email_a@example.com', 'admin_email_b@example.com'] } } });
    await prisma.madrasa.deleteMany({ where: { code: { in: ['TEST_MAIL_A', 'TEST_MAIL_B'] } } });
    await prisma.plan.deleteMany({ where: { code: 'TEST_MAIL_PLAN' } });

    const testPlan = await prisma.plan.create({
      data: {
        name: 'Test Mail Plan',
        code: 'TEST_MAIL_PLAN',
        durationMonths: 12,
        price: 100.0,
        isActive: true,
      },
    });

    const now = new Date();

    // Create Madrasa A
    madrasaA = await prisma.madrasa.create({
      data: {
        code: 'TEST_MAIL_A',
        name: 'Al Mahmoodhiyya Madrasa',
        slug: 'test-mail-a',
        email: 'office@almahmoodhiyya.lk',
      },
    });

    await prisma.subscription.create({
      data: {
        madrasaId: madrasaA.id,
        planId: testPlan.id,
        status: 'ACTIVE',
        startsAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000),
        priceAtPurchase: 100.0,
        durationMonthsAtPurchase: 12,
      },
    });

    adminA = await prisma.user.create({
      data: {
        name: 'Admin A',
        email: 'admin_email_a@example.com',
        passwordHash: 'hash',
        role: 'MADRASA_ADMIN',
        madrasaId: madrasaA.id,
      },
    });
    tokenA = signAccessToken({ userId: adminA.id, role: adminA.role, madrasaId: madrasaA.id });

    // Create Madrasa B
    madrasaB = await prisma.madrasa.create({
      data: {
        code: 'TEST_MAIL_B',
        name: 'Darul Uloom Madrasa',
        slug: 'test-mail-b',
        email: 'info@darululoom.lk',
      },
    });

    await prisma.subscription.create({
      data: {
        madrasaId: madrasaB.id,
        planId: testPlan.id,
        status: 'ACTIVE',
        startsAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000),
        priceAtPurchase: 100.0,
        durationMonthsAtPurchase: 12,
      },
    });

    adminB = await prisma.user.create({
      data: {
        name: 'Admin B',
        email: 'admin_email_b@example.com',
        passwordHash: 'hash',
        role: 'MADRASA_ADMIN',
        madrasaId: madrasaB.id,
      },
    });
    tokenB = signAccessToken({ userId: adminB.id, role: adminB.role, madrasaId: madrasaB.id });
  });

  afterEach(() => {
    clearTestEmails();
  });

  describe('1. Clean Start & Default Settings', () => {
    it('returns PLATFORM mode by default when no settings row exists', async () => {
      const res = await makeRequest(app, 'GET', '/api/madrasa-admin/settings/email-sender', {
        Authorization: `Bearer ${tokenA}`,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.mode, 'PLATFORM');
      assert.equal(res.body.data.hasSmtpPassword, false);
      assert.equal(res.body.data.isVerified, false);
    });

    it('resolves email sender to platform managed sender when no settings row exists', async () => {
      const resolved = await resolveEmailSenderForMadrasa(madrasaA.id);
      assert.equal(resolved.isCustom, false);
      assert.equal(resolved.from.includes('Al Mahmoodhiyya Madrasa'), true);
      assert.equal(resolved.transporter, null);
    });
  });

  describe('2. Encryption & Credential Security', () => {
    it('encrypts and decrypts credentials accurately with AES-256-GCM', () => {
      const secret = 'MySecretAppPassword123!';
      const encrypted = encryptCredential(secret);
      assert.notEqual(encrypted, secret);
      assert.equal(encrypted.includes(':'), true);

      const decrypted = decryptCredential(encrypted);
      assert.equal(decrypted, secret);
    });

    it('never exposes password ciphertext or plaintext in GET or PUT API responses', async () => {
      const payload = {
        mode: 'CUSTOM_SMTP',
        fromName: 'Al Mahmoodhiyya Madrasa',
        fromEmail: 'sender@almahmoodhiyya.lk',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecurity: 'STARTTLS',
        smtpUsername: 'sender@almahmoodhiyya.lk',
        smtpPassword: 'SecretAppPassword123',
      };

      const putRes = await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        payload
      );

      assert.equal(putRes.status, 200);
      assert.equal(putRes.body.data.hasSmtpPassword, true);
      assert.equal(putRes.body.data.smtpPassword, undefined);
      assert.equal(putRes.body.data.smtpPasswordEncrypted, undefined);

      const getRes = await makeRequest(app, 'GET', '/api/madrasa-admin/settings/email-sender', {
        Authorization: `Bearer ${tokenA}`,
      });

      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.hasSmtpPassword, true);
      assert.equal(getRes.body.data.smtpPassword, undefined);
      assert.equal(getRes.body.data.smtpPasswordEncrypted, undefined);
    });
  });

  describe('3. SSRF & Host Protection', () => {
    it('blocks localhost, loopback, and private IPv4 addresses', async () => {
      assert.equal((await validatePublicSmtpHost('localhost')).valid, false);
      assert.equal((await validatePublicSmtpHost('127.0.0.1')).valid, false);
      assert.equal((await validatePublicSmtpHost('10.0.0.1')).valid, false);
      assert.equal((await validatePublicSmtpHost('192.168.1.50')).valid, false);
      assert.equal((await validatePublicSmtpHost('172.16.0.10')).valid, false);
      assert.equal((await validatePublicSmtpHost('169.254.169.254')).valid, false);
    });

    it('blocks IPv6 loopback and link-local addresses', async () => {
      assert.equal((await validatePublicSmtpHost('::1')).valid, false);
      assert.equal((await validatePublicSmtpHost('fe80::1')).valid, false);
    });

    it('rejects PUT request when host is a private IP address', async () => {
      const res = await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        {
          mode: 'CUSTOM_SMTP',
          fromName: 'Al Mahmoodhiyya Madrasa',
          fromEmail: 'sender@almahmoodhiyya.lk',
          smtpHost: '127.0.0.1',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'user@almahmoodhiyya.lk',
          smtpPassword: 'password123',
        }
      );

      assert.equal(res.status, 400);
      assert.equal(res.body.message.includes('SMTP_HOST_NOT_ALLOWED'), true);
    });
  });

  describe('4. Tenant Isolation', () => {
    it('prevents Madrasa B from reading Madrasa A email settings', async () => {
      // Save settings for A
      await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        {
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
          smtpPassword: 'passwordA',
        }
      );

      // Query settings for B
      const resB = await makeRequest(app, 'GET', '/api/madrasa-admin/settings/email-sender', {
        Authorization: `Bearer ${tokenB}`,
      });

      assert.equal(resB.status, 200);
      assert.notEqual(resB.body.data.fromName, 'Madrasa A');
      assert.equal(resB.body.data.mode, 'PLATFORM');
    });
  });

  describe('5. Password Preservation & Updating Semantics', () => {
    it('preserves existing password when updating settings without passing password', async () => {
      // 1. Initial save with password
      await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        {
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
          smtpPassword: 'InitialPassword123',
        }
      );

      // 2. Update fromName without providing password
      const res = await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        {
          mode: 'CUSTOM_SMTP',
          fromName: 'Updated Madrasa Name',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
        }
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.data.hasSmtpPassword, true);
      assert.equal(res.body.data.fromName, 'Updated Madrasa Name');
    });
  });

  describe('6. Verification & Invalidation Rules', () => {
    it('invalidates verification state and increments configVersion when sensitive fields change', async () => {
      // 1. Setup initial verified setting
      const record = await prisma.madrasaEmailSetting.create({
        data: {
          madrasaId: madrasaA.id,
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
          smtpPasswordEncrypted: encryptCredential('password123'),
          isVerified: true,
          configVersion: 1,
        },
      });

      assert.equal(record.isVerified, true);

      // 2. Update smtpHost (sensitive field)
      const res = await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        {
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.sendgrid.net',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
        }
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.data.isVerified, false);
      assert.equal(res.body.data.configVersion, 2);
    });

    it('preserves verification state when only fromName changes', async () => {
      await prisma.madrasaEmailSetting.create({
        data: {
          madrasaId: madrasaA.id,
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
          smtpPasswordEncrypted: encryptCredential('password123'),
          isVerified: true,
          configVersion: 1,
        },
      });

      const res = await makeRequest(
        app,
        'PUT',
        '/api/madrasa-admin/settings/email-sender',
        { Authorization: `Bearer ${tokenA}` },
        {
          mode: 'CUSTOM_SMTP',
          fromName: 'New Display Name Only',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
        }
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.data.isVerified, true);
      assert.equal(res.body.data.fromName, 'New Display Name Only');
    });
  });

  describe('7. Test Endpoint & Recipient Restriction', () => {
    it('rejects test connection request with arbitrary external recipient', async () => {
      await prisma.madrasaEmailSetting.create({
        data: {
          madrasaId: madrasaA.id,
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
          smtpPasswordEncrypted: encryptCredential('password123'),
          isVerified: false,
        },
      });

      const res = await makeRequest(
        app,
        'POST',
        '/api/madrasa-admin/settings/email-sender/test',
        { Authorization: `Bearer ${tokenA}` },
        { recipientEmail: 'arbitrary_attacker@external.com' }
      );

      assert.equal(res.status, 400);
      assert.equal(res.body.message.includes('Test email can only be sent to the authenticated Administrator email'), true);
    });

    it('allows test connection request for authenticated admin email in test mode', async () => {
      await prisma.madrasaEmailSetting.create({
        data: {
          madrasaId: madrasaA.id,
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A',
          fromEmail: 'admin@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'admin@madrasaa.com',
          smtpPasswordEncrypted: encryptCredential('password123'),
          isVerified: false,
        },
      });

      const res = await makeRequest(
        app,
        'POST',
        '/api/madrasa-admin/settings/email-sender/test',
        { Authorization: `Bearer ${tokenA}` },
        { recipientEmail: adminA.email }
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.data.isVerified, true);
    });
  });

  describe('8. Platform vs Tenant Email Dispatch Boundary', () => {
    it('dispatches platform approval email strictly via platform sender without checking tenant custom settings', async () => {
      await prisma.madrasaEmailSetting.create({
        data: {
          madrasaId: madrasaA.id,
          mode: 'CUSTOM_SMTP',
          fromName: 'Madrasa A Custom',
          fromEmail: 'custom@madrasaa.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          smtpUsername: 'custom@madrasaa.com',
          smtpPasswordEncrypted: encryptCredential('password123'),
          isVerified: true,
        },
      });

      await sendApprovalEmail({
        to: 'applicant@example.com',
        applicantName: 'Applicant Name',
        madrasaName: madrasaA.name,
        planName: 'Standard Plan',
        adminEmail: 'admin@example.com',
      });

      const testMails = getTestEmails();
      assert.equal(testMails.length, 1);
      assert.equal(testMails[0].to, 'applicant@example.com');
      assert.equal(testMails[0].madrasaId, undefined);
    });

    it('dispatches manual salary paid email and direct ustadh email via resolved tenant sender', async () => {
      await sendUstadhSalaryPaidEmail({
        madrasaId: madrasaA.id,
        to: 'ustadh@example.com',
        ustadhName: 'Ustadh Ahmad',
        madrasaName: madrasaA.name,
        salaryMonth: 'September 2026',
        amount: 'LKR 45,000.00',
        paymentDate: '2026-09-30',
        paymentMethod: 'Bank Transfer',
      });

      const testMails = getTestEmails();
      assert.equal(testMails.length, 1);
      assert.equal(testMails[0].to, 'ustadh@example.com');
      assert.equal(testMails[0].madrasaId, madrasaA.id);
    });
  });
});
