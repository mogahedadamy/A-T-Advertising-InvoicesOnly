import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.taadvertising.invoicing",
  appName: "T.A فواتير وحاسبة",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0D4A39",
    },
  },
};

export default config;
