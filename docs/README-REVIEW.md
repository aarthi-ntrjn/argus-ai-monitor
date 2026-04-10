# Review

This file is a manual audit of all the code across the Argus project.

## 04/10/2026

- [] **`.claude`** -
- [] **`.github`** -
- [] **`.specify`** -
- [] **`.vscode`** -
- [] **`backend`** -
- [] **`doc`** -
- [] **`frontend`** -
- [x] **`images`** - This folder contains the argus logo.
- [x] **`node_modules`** - The git ignored modules
- [x] **`scripts`** - The scripts use by contributors reset-db and kill-port
- [x] **`specs`** - Speckit generated specs
- [x] `.gitignore` - The git ignored files
- [x] `CLAUDE.md` - CLAUDE MD
- [x] `package-lock.json` - The autogenerate package-lock.json
- [x] `package.json` - The project package
- [x] `playwright.config.ts` - The playwright config for the e2e tests
- [x] `playwright.real.config.ts` - The playwright config for the e2e:real tests
- [x] `README.md` - This file describes a high level view of Argus for its users.

### To understand & fix

- [] The docs folder needs to go to the end or beginning
- [] The README.md has a bunch of inline comment that need to get fixed.
- [] Playwright.real.config.ts strategy is incomplete. I want it to test against and actual repository and make it a truly e2e test. This needs rethinking.
- [] Playwright.config.ts - this file needs a description on what these tests are for and how they run. I believe the backend if largely mocked.
- [] package.json i dont see any tests that test only the backend
- [] package-lock.json there are packages with ^ how to prevent this.
- [] package-lock.json how to make sure that the dependencies are truly needed.
- [] dependabot There are vulnerabilities reported. how to fix it consistently
- [] claude.md has aarthin comments. fix them
- [] .gitignore - add comments properly and perhaps order them better.
- [] specs - check if there are any incomplete tasks
- [] The specs folder also needs to go to the end or beginning
- [] The specs folder has a lot of old specs now. what is the strategy to keep it updated.
- [] Add comments for reset-db.ps1
- [] is kill-port.mjs not used for npm run dev?
- [] scripts - i see powershell scripts for both, will this work on Mac?
- [] node_modules - why is this present only for sqllite3
