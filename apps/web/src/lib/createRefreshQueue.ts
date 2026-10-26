/** Keep one trailing refresh when invalidations arrive during an active read. */
export function createRefreshQueue(initialRefresh: () => void) {
  let busy = true;
  let pending = false;
  let refresh = initialRefresh;

  const request = () => {
    if (busy) {
      pending = true;

      return;
    }

    busy = true;
    refresh();
  };

  return {
    clear() {
      pending = false;
    },
    request,
    setRefresh(next: () => void) {
      refresh = next;
    },
    settle(reading: boolean) {
      busy = reading;
      if (!busy && pending) {
        pending = false;
        request();
      }
    },
  };
}
