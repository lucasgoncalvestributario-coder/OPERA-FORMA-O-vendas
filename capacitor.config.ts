import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.operaformacao.app',
  appName: 'Opera Formação',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
