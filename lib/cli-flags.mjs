export function parseFlags(args) {
  const flags = {};
  const positional = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        const key = arg.slice(2, eq);
        flags[key] = coerce(arg.slice(eq + 1));
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1 && !isNumeric(arg)) {
      flags[arg.slice(1)] = true;
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { flags, positional };
}

function coerce(value) {
  if (value !== '' && !isNaN(Number(value))) return Number(value);
  return value;
}

function isNumeric(arg) {
  return arg !== '' && !isNaN(Number(arg));
}
