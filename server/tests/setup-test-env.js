// Setup environment variables for offline test executions
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://mock:mock@localhost:3306/mock_offline';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mock_test_super_secret_jwt_key_at_least_32_chars_long_12345';
