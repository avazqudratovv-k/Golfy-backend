// runs before every test file: deterministic config, never touches a real database or .env
process.env.SECRET_TOKEN = "test-secret-token-not-for-production";
process.env.NODE_ENV = "test";
delete process.env.CORS_ORIGINS;
delete process.env.ADMIN_SIGNUP_SECRET;
