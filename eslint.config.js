import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Components must use the shared stores (useStore / stores.X.update), never private copies.
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@/lib/storage",
          importNames: [
            "loadGoals", "saveGoals", "loadSessions", "saveSessions", "loadExerciseConfigs", "saveExerciseConfigs",
            "loadWeeklyPlan", "saveWeeklyPlan", "loadSettings", "saveSettings", "loadAchievements", "saveAchievements",
            "loadTemplates", "saveTemplates", "loadWeeklySchedule", "saveWeeklySchedule", "loadWeeklyFocus", "saveWeeklyFocus",
            "loadTimeBlocks", "saveTimeBlocks", "loadBlockCategories", "saveBlockCategories", "loadRepeatableBlocks",
            "saveRepeatableBlocks", "loadContacts", "saveContacts", "loadInteractions", "saveInteractions",
            "loadCommitments", "saveCommitments", "loadRelationshipGoals", "saveRelationshipGoals",
            "loadCustomExercises", "saveCustomExercises", "loadHabitLogs", "saveHabitLogs",
            "loadGoalTemplates", "saveGoalTemplates",
          ],
          message: "Use useStore(stores.X) to read and stores.X.update(prev => …) to write.",
        }],
      }],
      // toISOString() is the UTC date — "tomorrow" for US users every evening.
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name=/^(split|slice)$/][callee.object.callee.property.name='toISOString']",
        message: "toISOString() gives the UTC date. Use toDateKey()/todayKey() from @/lib/dates.",
      }],
    },
  },
  {
    // Migrations intentionally reproduce the old UTC behaviour to re-key legacy data.
    files: ["src/lib/migrations.ts", "src/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": "off" },
  },
);
