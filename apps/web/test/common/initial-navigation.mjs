import { setTimeout } from 'node:timers/promises';

// Docker interface churn can interrupt Chrome before an initial page reaches the app.
export async function navigateInitially(page, url) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.goto(url);
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Error) ||
        !error.message.includes('net::ERR_NETWORK_CHANGED')
      )
        throw error;

      await setTimeout(100);
    }
  }
}
