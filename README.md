# RAPID CROUSTI

Local restaurant planning and attendance application built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Node.js. The current implementation stores business records in the browser's `localStorage`; it does not currently connect to PostgreSQL or SQLite.

## Windows 11 setup

Install Node.js 24 LTS and npm. Open this folder in VS Code, then run in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open <http://localhost:3000>. The development server binds to loopback, so it is not exposed to the local network. Stop it with `Ctrl+C` in the terminal. `start-local.bat` runs the same server command without PowerShell script-policy changes.

No `.env` file, database service, cloud account, or API key is required by the current application. `drizzle.config.json` is leftover configuration: its referenced schema is absent and the application does not use that PostgreSQL connection.

## Initial employee roster

On the first browser read of the employee list, the application safely adds the supplied 18 employees to local storage. The morning team is assigned to Group A; the evening/night team is assigned to Group B. Existing records are retained, matching names are not duplicated, and a seed marker prevents deleted employees from returning on later reads. Hourly rates, phone numbers, and hire dates remain blank until entered by the restaurant. The October 12–18 schedule is not prefilled until its source screenshots are available and transcribed.

The Planning table accepts editable start/end times and saves each edit immediately to the same browser profile. When a current or future week is opened, missing assignments for active employees are saved using their configured team defaults (A: 11:00–19:30, B: 19:30–04:00, C: 04:00–11:00); existing shifts and OFF days are kept. Past weeks are not automatically backfilled. “Défaut” restores only that employee/day, and OFF can be toggled with the keyboard or mouse. Existing settings with the prior built-in A/B shift times are migrated once; customized group times are preserved. Overnight durations count across midnight. Empty, partial, invalid, or identical start/end values remain incomplete and are not counted as a 24-hour shift. Attendance records keep the expected hours captured when attendance is created, so changing a schedule does not rewrite historical attendance or payroll totals.

The Planning page's **Exporter Excel** action downloads a formatted `.xlsx` snapshot of the selected week. Choose the current team or all teams. A selected-team export has one team sheet; the all-team export uses one `Planning` sheet with separate Matin and Soir/Nuit sections, a color legend, daily totals, and a weekly recap. Cells show saved start/end times, `OFF`, or a clear incomplete/unplanned marker. Duration totals are numeric Excel durations, formatted as hours and minutes, and use the same overnight-safe validation as Planning. Exports use only saved schedules and active employee records; they do not copy example shifts or totals from the design reference, and they omit phone numbers and pay rates. No break deduction is applied because the app has no configured break rule.

## Checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

`check-project.bat` runs these checks in sequence and stops at the first failure. The test command uses Node's built-in test runner and TypeScript stripping, so use Node 24.

## Data, backup, and restore

The app currently keeps employees, schedules, attendance, notes, and settings in the current browser profile's `localStorage`. They survive browser and app restarts in that profile, but are not shared between browsers or Windows accounts and are not a database backup. In **Settings → Sauvegarde des données locales**, download a JSON backup and store it somewhere separate from this project. To restore, select a RAPID CROUSTI backup; the app downloads a copy of the current browser data before replacing it. Keep the backup file private because it contains employee information.

Automated tests cover backup validation, seeded employees, schedule defaults and persistence, payroll calculations, and generated Excel workbook content, formulas, styling, and print settings. A complete browser download/restore cycle and browser-based Excel button interaction have not been exercised in this environment.

## Current limitations

- The business data layer remains browser-local. This does not meet the multi-user/local-database requirement. A database migration needs a server API and coordinated asynchronous changes to the employee, planning, attendance, payroll, reports, and settings screens; the existing PostgreSQL config cannot safely provide that as-is.
- There is no authentication or role-based authorization. Keep the app on loopback and do not expose it to a public or shared network.
- Payroll presents an estimate from recorded hours minus configured hour penalties, multiplied by the employee hourly rate. Tax, social contributions, bonuses, overtime, and finalized payroll runs are not configured or calculated.
- Full CRUD, browser workflows, localStorage persistence across a real browser restart, responsive visual checks, and backup file download/restore still need end-to-end verification.

## Source layout

- `src/app/(dashboard)`: dashboard and business screens.
- `src/lib/data.ts`: current browser storage and attendance helpers.
- `src/lib/payroll.ts`: period payroll calculation.
- `src/lib/backup.ts`: versioned browser-data backup and validation.
- `src/app/api/health/route.ts`: process health endpoint.

The unrelated `Projet_Examen` directory contains a separate festival-management project and is not part of this Next.js app.

## Vercel deployment

The Next.js application is at the repository root, with routes under src/app. Set Vercel Root Directory to the repository root so the build runs from the directory containing package.json, next.config.ts, and src/app. The route group (dashboard) is omitted from public URLs; src/app/(dashboard)/planning/page.tsx serves /planning.
