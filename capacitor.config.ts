import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sagaz.app",
  appName: "Sagaz",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#0b0c0f",
      androidSplashResourceName: "splash",
      showSpinner: false,
      launchAutoHide: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#8b7bff",
    },
  },
};

export default config;
