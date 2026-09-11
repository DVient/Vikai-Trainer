import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * Screen-level crash guard (Phase 9.16): turns a silent white screen into
 * an actionable message. A screen that throws on a device (an old bundle
 * meeting newer data, a rogue store record) otherwise gives the athlete
 * nothing to report — this shows what happened, how to recover (restart to
 * pick up the latest version), and asks for the About screen's version
 * card, which names the exact running bundle.
 *
 * Deliberately a class component: only class boundaries catch render-phase
 * errors. The wrapper host screen must render this ABOVE the fallible
 * screen component (wrap the default export, not the inside of it), or
 * hook-level throws escape it.
 */

interface ScreenErrorBoundaryProps {
  /** Athlete-facing subject in the fallback ("the calendar"). */
  label: string;
  children: ReactNode;
}

interface ScreenErrorBoundaryState {
  failed: boolean;
  message: string | null;
}

export class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  override state: ScreenErrorBoundaryState = { failed: false, message: null };

  static getDerivedStateFromError(
    error: unknown,
  ): ScreenErrorBoundaryState {
    return {
      failed: true,
      message: error instanceof Error ? error.message : null,
    };
  }

  override componentDidCatch(): void {
    // No reporting sink exists (everything stays on-device by design);
    // the fallback itself is the diagnostic surface.
  }

  private readonly reset = () => {
    this.setState({ failed: false, message: null });
  };

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <View className="flex-1 items-center justify-center bg-app p-6">
        <View className="w-full max-w-md gap-3 rounded-2xl border-2 border-shield-line bg-card p-4">
          <Text className="text-sm font-bold text-strong">
            The {this.props.label} couldn't load.
          </Text>
          <Text className="text-sm leading-5 text-body">
            Close and reopen the app to pick up the latest version — if it keeps
            happening, tell us what the About screen's version card says.
          </Text>
          {this.state.message !== null ? (
            <Text className="text-xs text-faint">{this.state.message}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Try again: ${this.props.label}`}
            onPress={this.reset}
            className="h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
          >
            <Text className="text-sm font-bold text-strong">Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}