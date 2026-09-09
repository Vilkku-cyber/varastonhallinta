import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  // Vercel must never publish a browser-local inventory by accident.
  if (command === 'build' && env.VERCEL === '1') {
    const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_DATABASE_URL', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
    if (env.VITE_STORAGE !== 'firebase' || required.some((key) => !env[key])) {
      throw new Error('Vercel release requires VITE_STORAGE=firebase and complete Firebase configuration. Complete the database migration before deploying.');
    }
  }
  return { define: { 'import.meta.env.VITE_DEMO_SETUP': JSON.stringify(env.VERCEL_ENV === 'preview' ? 'enabled' : 'disabled') } };
});
