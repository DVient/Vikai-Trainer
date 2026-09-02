import { ScrollView, Text, View } from "react-native";

/**
 * "How this app works" — the athlete-facing tour of everything built into
 * Vikai Trainer, written for a teenager: short sentences, the app's own
 * vocabulary (Full Send / Power Save / SHIELD / Game Plan / Ready State),
 * zero engine or clinical terminology. Pure static content — no state,
 * no navigation; the stack header provides the way back.
 */

interface Section {
  title: string;
  items: string[];
}

const HERO = {
  title: "Your pocket training coach 🏀",
  body: "Vikai Trainer builds your workout day around YOU — how you slept, how your body feels, what's on your schedule, and what you've already done this week. Same effort, smarter placement.",
};

const FLOW: Section = {
  title: "Your day in three taps",
  items: [
    "1 · Check in — sleep, body feel, energy. Ten seconds, three taps.",
    "2 · Log activities — practices, games, other sports. What happened BEFORE your workout shapes today. What happens AFTER shapes your next one.",
    "3 · Complete your Game Plan — check blocks off as you go. Tapped one by mistake? Tap again to undo.",
  ],
};

const LEVELS: Section = {
  title: "How the plan adapts",
  items: [
    "Full Send 🔥 — you're charged. The plan runs at 100%.",
    "Power Save 🌙 — short sleep, a heavy week, or a game coming up: same exercises, fewer sets. Keep the weight, drop the extra sets. The extras get trimmed first — your focus areas keep their work longest.",
    "SHIELD 🔴 — your body says stop. Any pain note pauses the loading and an adult should check in. Safety first, always.",
  ],
};

const FEATURES: Section = {
  title: "What's inside",
  items: [
    "🔋 Ready State — the battery on Home shows your charge for today.",
    "📋 Game Plan — today's plan with live check-offs, undo, and 'See the work' for every exercise, including videos.",
    "📝 Practice Log — record what you did around training, before or after.",
    "📅 Calendar — your past and future at a glance. Add games and practices, change times when plans move, and build a whole practice series in one go.",
    "🔔 Reminders — fuel-up and check-in nudges, plus a heads-up before each event you schedule.",
    "🔥 Streak — check in every day and watch it grow.",
  ],
};

const RULES: Section = {
  title: "The rules it lives by",
  items: [
    "Pain is a stop sign — never a push-through.",
    "Fresh legs win games — heavy impact work dials down before game day.",
    "Hard days are followed by easier ones. The high/low rhythm is what builds you.",
    "Everything stays on your phone — no accounts, nothing uploaded.",
  ],
};

const SECTIONS: Section[] = [FLOW, LEVELS, FEATURES, RULES];

function SectionCard({ section }: { section: Section }) {
  return (
    <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
      <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {section.title}
      </Text>
      <View className="mt-2 gap-2">
        {section.items.map((item) => (
          <Text key={item} className="text-sm leading-5 text-slate-200">
            {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function About() {
  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="items-center px-4 pb-8">
      <View className="w-full max-w-md gap-4">
        <View className="rounded-2xl border-2 border-green-500/40 bg-green-500/10 p-4">
          <Text className="text-lg font-black text-green-300">{HERO.title}</Text>
          <Text className="mt-1 text-sm leading-5 text-slate-200">{HERO.body}</Text>
        </View>

        {SECTIONS.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}

        <Text className="text-center text-xs text-slate-500">
          Made for hoopers who want to play long — not just hard. 🏀
        </Text>
      </View>
    </ScrollView>
  );
}
