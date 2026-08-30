import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "Vikai" }} />
        {/* Phase 4 registers checkin, activity-log, and workout screens here. */}
      </Stack>
    </>
  );
}
