import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "Vikai" }} />
        <Stack.Screen name="checkin" options={{ title: "Daily check-in" }} />
        <Stack.Screen name="activity-log" options={{ title: "Log activity" }} />
        <Stack.Screen name="workout" options={{ title: "Today's workout" }} />
      </Stack>
    </>
  );
}
