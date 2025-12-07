# Tests — Ripple consolidation checks

This folder contains smoke tests for the project. Two small checks were added to verify the ripple CSS consolidation:

- `check-ripple.ps1` — PowerShell script (Windows / PS Core). Runs a file search to ensure:
  - `.ripple {` and `@keyframes ripple` exist only in `assets/css/ripple-styles.css`.
  - Main HTML pages include `assets/css/ripple-styles.css`.

- `check-ripple.js` — Node.js script that performs the same checks cross-platform.

How to run

PowerShell (Windows / PS Core):

```powershell
# from project root
pwsh -File tests/check-ripple.ps1
```

Node.js (cross-platform):

```bash
# from project root
node tests/check-ripple.js
```

The main test runner `tests/run-tests.js` now includes `check-ripple.js` so running

```bash
node tests/run-tests.js
```

will also run the ripple checks (if Node.js is installed).
