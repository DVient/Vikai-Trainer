VIKAI — AGENT SYSTEM INSTRUCTIONS & GUARDRAILS

1. AGENT ROLES & RESPONSIBILITIES
When executing tasks on this codebase, assume the relevant specialized role based on the task type:
• Core Logic Agent: Implements domain models, pure mathematical functions, training phase logic, and the pure evaluateAutoregulationEngine[cite: 1]. Must enforce zero side effects in core engine code[cite: 1].
• Local Storage & State Agent: Manages Zustand state schemas, TypeScript interface alignments, and local persistence via AsyncStorage/MMKV[cite: 1, 3].
• Frontend UI/UX Agent: Builds React Native (Expo Router) screens and NativeWind components[cite: 1]. Enforces accessible touch targets (≥48x48px) and responsive mobile layouts[cite: 1].
• QA & Test Agent: Writes and executes Vitest unit tests and React Native Testing Library suites[cite: 1]. Validates edge cases, RPE boundaries, game proximity windows, and local store actions[cite: 1].

───

2. STRICT SYSTEM GUARDRAILS & NON-NEGOTIABLES
Every agent working on this repository must strictly adhere to the following build rules:
1. Architecture Decoupling:
◦ The Readiness / Autoregulation Engine MUST NOT generate workouts or select individual exercises[cite: 1, 3]. It ONLY calculates restriction constraints (TrainingRestrictions)[cite: 1, 3].
◦ The Workout Generator maps restrictions onto base plans separately[cite: 1].
2. Safety & Medical Non-Goals:
◦ NEVER output medical diagnoses, rehabilitation protocols, or injury severity assessments[cite: 1, 3].
◦ If jointStatus === "PAIN_CONCERN", immediately set status = "RED", halt lower/upper body loading, and set requiresAdultAttention = true[cite: 1, 3]. Do NOT prescribe corrective exercises[cite: 1, 3].
3. Tech Stack Constraints:
◦ Framework: React Native with Expo SDK and Expo Router[cite: 1, 3].
◦ Styling: NativeWind (Tailwind CSS)[cite: 1, 3].
◦ Architecture: Serverless, client-only architecture. No Supabase, no webservers, no SQL migrations, and no ORMs[cite: 1, 3].
◦ State & Storage: Zustand with local persistent storage (AsyncStorage or MMKV)[cite: 1, 3].
◦ Testing: Vitest for pure logic; React Native Testing Library for UI components[cite: 1].
4. Code Quality:
◦ Strict TypeScript mode enforced. NO any types permitted[cite: 1, 3].
◦ All functions in src/engine/ must remain pure and deterministic (no storage access, no system clocks inside functions—accept now: Date as an input parameter)[cite: 1].
5. Notification Guardrails:
◦ NEVER use cancelAllScheduledNotificationsAsync()[cite: 1, 3]. Always track specific notification string IDs in local state[cite: 1, 3].

───

3. PROMPT & EXECUTION PROTOCOL
• Single Phase Execution: Focus strictly on the task defined in the current phase of FLOW.MD[cite: 1]. Do NOT jump ahead to future phases[cite: 1].
• Test-Driven Verification: Do not mark a phase complete until all associated Vitest tests pass[cite: 1].
• Incremental Commits: Commit code after each successful phase before requesting the next prompt[cite: 1].