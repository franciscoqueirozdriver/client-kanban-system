const twMerge = (...classes) =>
  classes
    .flat(Infinity)
    .filter(Boolean)
    .map((value) => {
      if (typeof value === 'object') {
        return Object.entries(value)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key)
          .join(' ');
      }
      return String(value);
    })
    .join(' ');

module.exports = { twMerge, default: twMerge };
