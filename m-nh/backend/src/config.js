import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3978),
  appOrigin: process.env.APP_ORIGIN || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  reminderCron: process.env.REMINDER_CRON || "*/15 * * * *",
  overdueGraceMinutes: Number(process.env.OVERDUE_GRACE_MINUTES || 0),
};

export function assertConfig() {
  const missing = Object.entries({
    SUPABASE_URL: config.supabaseUrl,
    SUPABASE_ANON_KEY: config.supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceRoleKey,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}
