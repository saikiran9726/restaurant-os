import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.restaurantos.pos',
  appName: 'Restaurant OS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // Allow LAN printing over local HTTP / raw IP
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
