const React = require('react');

const Command = React.forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
Command.displayName = 'CmdkCommand';

Command.Input = React.forwardRef(({ onChange, ...props }, ref) => (
  <input
    ref={ref}
    onChange={(event) => {
      onChange?.(event);
    }}
    {...props}
  />
));
Command.Input.displayName = 'CmdkCommandInput';

Command.List = React.forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
Command.List.displayName = 'CmdkCommandList';

Command.Empty = React.forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
Command.Empty.displayName = 'CmdkCommandEmpty';

Command.Group = React.forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
Command.Group.displayName = 'CmdkCommandGroup';

Command.Separator = React.forwardRef((props, ref) => <div ref={ref} {...props} />);
Command.Separator.displayName = 'CmdkCommandSeparator';

Command.Item = React.forwardRef(({ children, onSelect, onClick, value, ...props }, ref) => (
  <div
    ref={ref}
    onClick={(event) => {
      onSelect?.(value ?? '');
      onClick?.(event);
    }}
    {...props}
  >
    {children}
  </div>
));
Command.Item.displayName = 'CmdkCommandItem';

module.exports = { Command };
