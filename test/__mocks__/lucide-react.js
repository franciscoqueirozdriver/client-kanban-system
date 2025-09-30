const React = require('react');

const MockIcon = React.forwardRef((props, ref) =>
  React.createElement('svg', { ref, ...props })
);

MockIcon.displayName = 'LucideIconMock';

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === '__esModule') {
        return true;
      }
      return MockIcon;
    },
  }
);
