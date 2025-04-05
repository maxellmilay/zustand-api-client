// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Use 'jsdom' if you need browser APIs like fetch
  roots: ['<rootDir>/src'], // Look for tests in the src directory
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)', // Finds tests in any __tests__ folder
    '**/?(*.)+(spec|test).+(ts|tsx|js)', // Finds files with .test.ts or .spec.ts extensions
  ],
  transform: {
    '^.+\.(ts|tsx)$': ['ts-jest', {
      // ts-jest configuration options
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    // Prevent zustand from trying to import React in test environment
    '^react$': '<rootDir>/__mocks__/react.js', // Point react to a mock file
    // If you use module aliases in tsconfig, add them here
    // Example: '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverage: true, // Enable coverage collection
  coverageDirectory: 'coverage', // Output directory for coverage reports
  coverageProvider: 'v8', // Use V8 for coverage (works well with Node.js)
}; 