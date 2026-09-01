# Security policy

## Supported versions

The latest 0.x release of astro-inkstone on `main`. Older tags receive no fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's
private vulnerability reporting for this repository — **Security → Report a
vulnerability** — which is enabled here and reaches the maintainer directly.
Include the affected version, a minimal reproduction and the impact you see.
You will get an acknowledgement within seven days, and a fix or a clear
statement before anything is disclosed.

## Scope

astro-inkstone is the appearance layer — CSS, components, fonts and a
Markdown pipeline preset that run at build time and in the reader's browser.
The in-place editing server (authentication, the save gate, the AI assist
sandbox, shares) lives in the engine, [astro-inkbrush](https://github.com/ventusff/astro-inkbrush);
report engine issues through that repository's security page.
