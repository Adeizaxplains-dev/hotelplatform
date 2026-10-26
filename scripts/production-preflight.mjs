#!/usr/bin/env node
// Non-secret deployment checklist. Does not print environment values.
import process from 'node:process';

const errors = [];
const warnings = [];
const present = (key) => Boolean(process.env[key]?.trim());
const validOrigin = (value) => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && url.origin === value;
  } catch {
    return false;
  }
};

if (process.env.NODE_ENV !== 'production') errors.push('NODE_ENV must be production for a production release.');
for (const key of ['DATABASE_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'CLIENT_URL', 'PLATFORM_DOMAIN']) {
  if (!present(key)) errors.push(`${key} is required.`);
}
for (const key of ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']) {
  if (present(key) && process.env[key].length < 32) errors.push(`${key} must be at least 32 characters.`);
}
if (present('ACCESS_TOKEN_SECRET') && process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
  errors.push('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different.');
}
const origins = (process.env.CLIENT_URL ?? '').split(',').map((item) => item.trim()).filter(Boolean);
if (origins.some((origin) => !validOrigin(origin) || !origin.startsWith('https://'))) {
  errors.push('Every CLIENT_URL entry must be an HTTPS origin with no path or wildcard.');
}
if (process.env.AUTH_RATE_LIMIT_SCALE && Number(process.env.AUTH_RATE_LIMIT_SCALE) !== 1) {
  errors.push('AUTH_RATE_LIMIT_SCALE must be 1 in production.');
}
if (!/^(?=.{3,253}$)([a-z0-9-]+\.)*[a-z0-9-]+$/.test(process.env.PLATFORM_DOMAIN ?? '')) {
  errors.push('PLATFORM_DOMAIN must be a bare lowercase domain without scheme or port.');
}
if (process.env.MEDIA_PROVIDER === 'local') errors.push('MEDIA_PROVIDER=local is not suitable for production.');
if (process.env.MEDIA_PROVIDER !== 'cloudinary' && !(present('CLOUDINARY_CLOUD_NAME') && present('CLOUDINARY_API_KEY') && present('CLOUDINARY_API_SECRET'))) {
  warnings.push('Cloud image storage is not configured; production uploads may be unavailable.');
}
if (process.env.EMAIL_PROVIDER !== 'smtp') warnings.push('EMAIL_PROVIDER is not smtp; configure and verify a production email provider before guest notifications.');
if (process.env.EMAIL_PROVIDER === 'smtp' && !['EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].every(present)) {
  errors.push('SMTP is selected but one or more required SMTP settings are missing.');
}
if (!present('PAYSTACK_SECRET_KEY') || !present('PAYSTACK_PUBLIC_KEY')) warnings.push('Paystack credentials are incomplete; gateway payment flows may be unavailable.');
if (!['SAAS_WEBSITE_MONTHLY_KOBO', 'SAAS_BOOKING_MONTHLY_KOBO', 'SAAS_MANAGEMENT_MONTHLY_KOBO'].every(present)) {
  warnings.push('One or more SaaS plan prices are unset; subscription checkout for those plans should remain disabled.');
}
if (!present('TRUST_PROXY')) warnings.push('Set TRUST_PROXY to the correct trusted proxy hop count for your actual hosting topology.');

for (const warning of warnings) process.stdout.write(`WARN: ${warning}\n`);
for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
if (errors.length) {
  process.stderr.write(`\nPreflight failed with ${errors.length} blocking issue(s) and ${warnings.length} warning(s). No secret values were printed.\n`);
  process.exit(1);
}
process.stdout.write(`\nPreflight passed with ${warnings.length} warning(s). This does not replace tests, security review, or a production smoke test.\n`);
