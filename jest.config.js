const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^lucide-react$': '<rootDir>/test/__mocks__/lucide-react.js',
    '^class-variance-authority$': '<rootDir>/test/__mocks__/class-variance-authority.js',
    '^clsx$': '<rootDir>/test/__mocks__/clsx.js',
    '^tailwind-merge$': '<rootDir>/test/__mocks__/tailwind-merge.js',
    '^@radix-ui/react-.*$': '<rootDir>/test/__mocks__/radix.js',
    '^cmdk$': '<rootDir>/test/__mocks__/cmdk.js',
  },
};

module.exports = createJestConfig(customJestConfig);
