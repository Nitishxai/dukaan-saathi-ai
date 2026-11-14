# Reliability verification

The original working tree contained uncommitted changes. Work continued on `fix/pilot-reliability` without resetting or staging those files. Verification used synthetic shops and temporary databases.

| Baseline check | Observed result |
| --- | --- |
| Existing regression suite | 25 passed, including a test that expected an unsigned webhook to report success |
| ESLint | Passed |
| Initial typecheck | Raced with the concurrent build while generated route types were being replaced |
| Initial production build | Failed on remote font lookup and Windows generated-directory permissions |

Four added regressions failed against the starting implementation before fixes: forged line totals, malformed nested backup items, replacement of damaged bytes during initialization, and profile creation on a full storage device. Other findings were investigated through source inspection and targeted checks. A baseline browser reproduction was not obtained for every reported issue.

The expanded suite exercises deterministic bill arithmetic, retries after reload, stale writes, credit offsets, corrupted storage, validated backup restoration, Indian business-day boundaries, AI unit conversion, and shop identity. Server integration tests use independent database connections and simultaneous workers to contest the last unit of stock. They also exercise authentication, membership, session revocation, import deduplication, audit snapshots, full returns and restoration from a consistent SQLite backup. The Web Locks test uses independent store modules with a shared native lock manager.

Browser preview attempts timed out and the execution environment denied a localhost socket request. Browser click-throughs, microphone permissions, actual two-tab behavior and mobile layout still need a device check. No external payment provider or paid AI request was exercised.

Final checks on 14 November: all 53 tests passed, ESLint passed and standalone TypeScript checking passed. The final source compiled and passed Next's TypeScript step, but the complete release build remained blocked by Windows EPERM during output generation/prerendering. A separate temporary checkout encountered webpack's prohibition on exclamation marks in its sandbox path. The earlier successful build preceded the final server changes and does not validate this release. Verify `npm run build` on a normal writable local checkout before pilot use.
