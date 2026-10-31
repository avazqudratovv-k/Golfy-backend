/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/helpers/env.ts"],
  testTimeout: 60000,
  // one in-memory MongoDB per test file; keep files serial so downloads/startup do not pile up
  maxWorkers: 1,
};
