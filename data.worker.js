// data.worker.js
// Runs OFF the main thread — parses JSON and sanitizes word data
// so the main thread never spends 100–200 ms on JSON.parse(243 KB).
//
// The sanitizer is shared with data.js via ./sanitize.js so both
// code paths always stay in sync.

import { sanitizeToeicData } from './sanitize.js';

self.onmessage = function (event) {
  const payload = event.data;

  // The main thread always sends the raw JSON string.
  if (typeof payload !== 'string') {
    self.postMessage({ __error: true, message: 'Unknown payload type' });
    return;
  }

  try {
    const parsed = JSON.parse(payload);
    const sanitized = sanitizeToeicData(parsed);
    self.postMessage(sanitized);
  } catch (err) {
    self.postMessage({ __error: true, message: err.message });
  }
};
