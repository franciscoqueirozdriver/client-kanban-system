const React = require('react');

function sanitizeProps(props) {
  const { asChild, sideOffset, align, ...rest } = props;
  return { asChild, rest, children: props.children };
}

function createComponent(tag) {
  return React.forwardRef((props, ref) => {
    const { asChild, rest, children } = sanitizeProps(props);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, { ref, ...rest });
    }
    return React.createElement(tag, { ref, ...rest }, children);
  });
}

module.exports = {
  Root: ({ children }) => React.createElement(React.Fragment, null, children),
  Trigger: createComponent('button'),
  Content: createComponent('div'),
  Portal: ({ children }) => React.createElement(React.Fragment, null, children),
};
