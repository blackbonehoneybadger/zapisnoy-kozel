import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zapisnoy.kozel',
  appName: 'Записной Козёл',
  webDir: 'dist',
  backgroundColor: '#08090b',
  android: {
    backgroundColor: '#08090b',
    allowMixedContent: false,
  },
};

export default config;
