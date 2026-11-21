const nextJest = require("next/jest");
const { config } = require("dotenv");

config({ path: ".env.development" });

const createJestConfig = nextJest({
  dir: ".",
});

const jestConfig = createJestConfig({
  moduleDirectories: ["node_modules", "<rootDir>"],
  testTimeout: 60000,
  collectCoverageFrom: [
    "features/**/lib/**/*.js",
    "infra/**/*.js",
    "lib/**/*.js",
    "models/**/*.js",
    "pages/api/**/*.js",
    "!infra/migrations/**",
    "!infra/scripts/**",
    "!**/*.test.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
});

module.exports = jestConfig;
