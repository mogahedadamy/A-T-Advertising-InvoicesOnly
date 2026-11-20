import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.taadvertising.invoicing",
  appName: "A-T-Advertising",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
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
