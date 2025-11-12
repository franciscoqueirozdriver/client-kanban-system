const clsx = (...classes) => {
  const normalized = [];
  classes.forEach((value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      normalized.push(clsx(...value));
    } else if (typeof value === 'object') {
      normalized.push(
        Object.entries(value)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key)
          .join(' ')
      );
    } else {
      normalized.push(String(value));
    }
  });
  return normalized.filter(Boolean).join(' ');
};

module.exports = { clsx, default: clsx };
