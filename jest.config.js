const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^clsx$': '<rootDir>/test/__mocks__/clsx.js',
    '^class-variance-authority$': '<rootDir>/test/__mocks__/class-variance-authority.js',
    '^tailwind-merge$': '<rootDir>/test/__mocks__/tailwind-merge.js',
    '^@radix-ui/react-popover$': '<rootDir>/test/__mocks__/radix-popover.js',
    '^@radix-ui/react-dialog$': '<rootDir>/test/__mocks__/radix-dialog.js',
    '^@radix-ui/react-slot$': '<rootDir>/test/__mocks__/radix-slot.js',
    '^cmdk$': '<rootDir>/test/__mocks__/cmdk.js',
    '^lucide-react$': '<rootDir>/test/__mocks__/lucide-react.js',
  },
};

module.exports = createJestConfig(customJestConfig);
