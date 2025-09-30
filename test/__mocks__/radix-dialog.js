const React = require('react');

function createComponent(tag) {
  return React.forwardRef(({ asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, { ref, ...props });
    }
    return React.createElement(tag, { ref, ...props }, children);
  });
}

module.exports = {
  Root: ({ children }) => React.createElement(React.Fragment, null, children),
  Trigger: createComponent('button'),
  Content: createComponent('div'),
  Overlay: createComponent('div'),
  Title: createComponent('h2'),
  Description: createComponent('p'),
};
