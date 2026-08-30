/// <reference types="nativewind/types" />

// NativeWind compiles className props from .css entry files; ambient wildcard
// declaration lets the side-effect import typecheck under strict TS 6.
declare module "*.css";
