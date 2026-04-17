# Rules

- All documentation in this project must be written in an agnostic, portable way. Do not reference specific usernames, machine paths, or environment details. This repository is meant to be shareable — anyone should be able to follow the docs and use the configurations in their own setup.

- Whenever a new component (hook, rule, skill, template, or any other installable artifact) is added, modified, or removed, update `manifest.json` to reflect the change. The manifest is the source of truth for the installer — components missing from it cannot be installed via `install.sh`. Also update any other affected files: `README.md` (component description), `installer/test/smoke.mjs` (if the component needs a new test case), and `CLAUDE.template.md` (if the component is a rule that belongs in the starter template). After any manifest change, run `node installer/test/smoke.mjs` to verify the manifest still validates and all components are reachable.
