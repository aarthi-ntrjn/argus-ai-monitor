# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Argus, please report it privately using
[GitHub's Private Vulnerability Reporting](https://github.com/aarthi-ntrjn/argus/security/advisories/new).

**Do not open a public issue for security vulnerabilities.**

We will acknowledge receipt within 72 hours and provide an initial assessment within one week.

## Security Model

Argus is a **single-user, localhost-only tool**. It binds exclusively to `127.0.0.1` and
is designed to run on the same machine as the AI sessions it monitors. This network
isolation is the primary security boundary.

Because Argus never listens on a network-accessible interface, no authentication or
authorization is required for the v1 release.

### Hardening Measures

| Area | Protection |
|------|-----------|
| **Network binding** | `127.0.0.1` only. No remote access. |
| **Process control** | Stop/interrupt requests validate PID ownership: the OS process must match the AI tool allowlist (Claude/Copilot) before any signal is sent. |
| **Shell injection** | All process termination calls use `spawnSync` with an explicit args array. No shell string interpolation. |
| **Filesystem access** | All user-supplied paths are resolved and validated against the home directory and registered repository paths. Paths outside this boundary are rejected. |
| **HTTP headers** | All responses include `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`. No server version information is exposed. |
| **Supply chain** | CI enforces lockfile integrity, action SHA pinning, lifecycle script allowlisting, and critical CVE auditing. See [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md#ci--supply-chain) for details. |

## Supported Versions

Only the latest version on the `master` branch is supported with security updates.

## Disclosure Timeline

1. Report received via GitHub Private Vulnerability Reporting
2. Acknowledgement within 72 hours
3. Initial assessment within 1 week
4. Fix developed and tested
5. Security advisory published with the fix
