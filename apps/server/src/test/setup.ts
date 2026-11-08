// Keep test output readable: the pino request logger reads LOG_LEVEL at import
// time, so this must run before the app modules are loaded (vitest setupFiles).
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
