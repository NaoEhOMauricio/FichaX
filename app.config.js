export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    'expo-web-browser',
  ],
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
