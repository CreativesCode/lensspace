# Refresh without polling (pilot bandwidth)

Date: 2026-10-02

How LensSpace keeps data fresh on weak Cuban links (QA-24..27). No polling, no Realtime.

- **Workspace state seeded from server props:** use `useServerState(initialX)`
  (`src/shared/hooks/use-server-state.ts`), never `useState(initialX)`, so
  `router.refresh()` and back/forward bring fresh lists.
- **Sidebar counters:** after a mutation that changes pending orders or production
  jobs, call `refreshNavigationCounters()` (`src/shared/lib/navigation-counters.ts`);
  layouts do not re-render on soft navigation.
- **Route refresh:** `RefreshOnFocus` in the `(main)` layout refreshes on back/forward,
  on `online`, and when the tab returns after ≥ 60 s hidden. Each costs one RSC
  request (~9 KB on `/sales`).
- Effects that depend on server props (e.g. auto-opening the first order) must not
  reset what the user has open when fresh props arrive.
- Sibling components must not share a React `key` (e.g. two panels keyed by order id).
