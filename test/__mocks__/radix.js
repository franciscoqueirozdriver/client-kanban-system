const React = require('react');

const createComponent = (displayName) => {
  const Component = React.forwardRef(({ children, ...props } = {}, ref) =>
    React.createElement('div', { ref, ...props }, children)
  );
  Component.displayName = displayName;
  return Component;
};

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === '__esModule') {
        return true;
      }
      if (prop === 'Portal') {
        return ({ children }) => React.createElement(React.Fragment, null, children);
      }
      if (prop === 'Slot') {
        return React.forwardRef(({ children, ...props } = {}, ref) => {
          if (React.isValidElement(children)) {
            return React.cloneElement(children, { ref, ...props });
          }
          return React.createElement('div', { ref, ...props }, children);
        });
      }
      return createComponent(`Radix${String(prop)}`);
    },
  }
);
