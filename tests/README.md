# Motion regression checks

Run `npm run build`, then `node scripts/prepare-motion-tests.mjs`, and serve
`dist` with `python3 -m http.server 4174 -d dist`. Open in **Google Chrome**:

- http://localhost:4174/tests/motion-regression.html
- http://localhost:4174/tests/motion-regression.html?reduced

The page tests the actual app in 390, 768, and 1280 px iframes. It checks the
synchronous first frame, exit persistence, card reuse, interruption continuity,
cancellation, and the receipt's frame-by-frame travel and final position.
`?reduced` simulates the application's reduced-motion media-query result; it
is not an OS-level accessibility or physical-device test.

For an uncommitted change, `node scripts/prepare-motion-tests.mjs --baseline`
also prepares `?baseline`, using `HEAD:src/app.js` for comparison. The normal
production build does not ship these test pages.

For visual acceptance, run the complete flow from `/?state=filled`: Send,
Accept plan, Approve & sign, and Confirm in the mock wallet. Reopen completed
blue cards and collapse them both during and after entry. Repeat on a real
phone and affected browsers: viewport tests do not reproduce their GPU stack.

## Mobile follow-up checks

Open `/tests/mobile-regression.html` in Chrome after preparing the test pages.
It covers 320, 390, and 412 px layouts: loaded Geist font faces and exported
weights, disabled tap highlight, DialKit removal, Android resize metadata,
composer visibility after a simulated keyboard-sized viewport shrink and
restore, running/paused wallet text wrapping, the 24 px composer gap, and
multi-frame summary scrolling. A viewport resize checks layout; it does not
emulate a physical Android keyboard.
