/**
 * Production-safe logger. console.log/warn/debug are no-ops in production builds.
 * console.error is always enabled — unexpected errors should always surface.
 *
 * Usage: import { logger } from './logger.js';
 *        logger.log('message');   // dev only
 *        logger.error('oops');    // always logged
 */
const isDev = import.meta.env.DEV;

export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  debug: isDev ? console.debug.bind(console) : () => {},
  error: console.error.bind(console),
};
