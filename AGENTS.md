# OpenCode Agent Skill & Standard Rules

## 1. Tech Stack & Dependencies
- **UI:** Preact (use hooks explicitly from `preact/hooks`, Preact JSX).
- **Styling:** Bootstrap 5 (prefer native Bootstrap utility classes, use modular CSS only if strictly necessary).
- **State & Data:** Local hooks for component UI state, Preact Context API for global state (Auth/User).
- **Backend:** Firebase Web SDK v9+ (Modular/Tree-shakable: Auth + Firestore).
- **Package Manager:** pnpm.

## 2. Code Style & Architecture Constraints
- **Pure Domain Logic:** All Colombian payroll calculations (overtime, night shifts, mandatory health/pension deductions) MUST live inside pure functions in `src/utils/`. NEVER compute payroll inside JSX or UI Components.
- **Firebase Abstraction:** Database and Authentication calls must be fully abstracted inside `src/services/`. Components should only invoke wrapper functions like `savePayrollDraft(data)`.
- **Currency & Formatting:** Always use `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` for monetary output formatting.
- **Token Efficiency:** Write concise, clean, and properly typed code. Avoid unnecessary boilerplate or verbose comments unless explaining complex Colombian labor law rules.