export const rustRuntime = {
  language: "rust",
  testCommand: ["cargo", "test", "--quiet"],
} as const;
