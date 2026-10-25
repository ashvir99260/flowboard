# Stable drag feedback

P37-01 fixes R172 while preserving R64/R162/R166: a dropped card remains in its projected position until a validated board snapshot replaces it. Local placement settlement and task-list invalidations refresh in the background. Only a previously complete, authorized snapshot may bridge those reads; workspace/configuration changes, reconnect/resync, explicit refresh and failed/invalid reads discard it. Actions stay disabled while a retained snapshot is reconciling.

The saved placement is folded into that retained snapshot before pending mutation state disappears. Failed placements remove their own projection and retain other pending changes. Success feedback is emitted once after the server mutation response has been validated; cancellation/no-op/failed requests never emit success. The board does not insert an inline saving banner that shifts its geometry.

Verification uses the browser boundary: gate the write and subsequent reads, track board/card continuity and vertical position, assert no premature success toast, then verify final order and exactly one completion toast. Also exercise rejection rollback, simultaneous tasks and access invalidation. Keep the existing generated client, cache scopes and version/cursor validation.

The shared toast host queues its imperative display call until container registration settles, including React StrictMode replay. Reduced-motion styling exempts the hidden dismissal timer: visible transitions remain reduced, but successful messages retain their six-second reading time. Replacing or clearing a message still removes its previous container immediately.
