# Horasapp Agent Guidelines

## Tech Stack
- **Core:** Preact (`preact/hooks`), Vite, Bootstrap 5.
- **Backend:** Firebase modular v9+ (Auth + Firestore). Pkg: `pnpm`.

## Architecture & Constraints
- **Pure Logic:** All Colombian payroll/labor logic (overtime, surcharges, deductions) MUST reside in `src/utils/`. Zero calculation logic inside JSX/components.
- **Service Layer:** All Firebase/Auth calls isolated in `src/services/`. Components consume wrapper functions only.
- **Formatting:** Use `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` for currency.

## ⚡ Token Efficiency Directives (Zero Waste)
- **Code Only / No Filler:** Omit conversational preambles, generic greetings, and post-code explanations unless explicitly asked. Output only the requested code blocks or diffs.
- **Concise Snippets:** Provide direct, target-focused code modifications instead of rewriting entire unedited files. Use clean placeholders (`// ... existing code ...`) for large files.
- **Terse Communication:** When answering conceptual or debugging questions, use dense bullet points and technical shorthand. Never restate user prompts.