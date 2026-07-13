/** Lightweight, dependency-free field validators used by master/invoice forms. */

export function isNonEmpty(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

export function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function isValidEmail(value) {
  if (!value) return true; // email is optional in most master records
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value) {
  if (!value) return true;
  return /^\d{10}$/.test(String(value).replace(/\D/g, '').slice(-10));
}

export function isValidGSTIN(value) {
  if (!value) return true; // some customers may be unregistered
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.toUpperCase());
}

/** Returns { valid, errors } where errors is a { field: message } map. */
export function validate(fields, rules) {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const ok = check.test(fields[field]);
      if (!ok) {
        errors[field] = check.message;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
