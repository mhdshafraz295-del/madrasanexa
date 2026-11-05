import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';
process.env.DATABASE_TEST_URL = process.env.DATABASE_TEST_URL || 'mysql://root:@127.0.0.1:3306/madrasanexa_test';

await import('./super-admin-features-plans.test.js');
