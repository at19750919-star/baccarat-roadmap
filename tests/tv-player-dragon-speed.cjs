const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, '../tv.html')).href + '?preview=dragon');
    const results = [];
    for (const side of ['B', 'P']) {
    await page.evaluate(side => {
      speech.enabled = false;
      state.rounds = [];
      window.speedEvidence = {};
      const video = document.getElementById('dragonVideo');
      video.addEventListener('playing', () => {
        speedEvidence.startedAt = performance.now();
        speedEvidence.duration = video.duration;
        speedEvidence.rate = video.playbackRate;
      }, {once: true});
      video.addEventListener('ended', () => {
        speedEvidence.elapsed = performance.now() - speedEvidence.startedAt;
        speedEvidence.lastTime = video.currentTime;
        speedEvidence.ended = video.ended;
      }, {once: true});
      for (let i = 0; i < getDragonThreshold() + 1; i++) addRound(side, {});
    }, side);
    await page.waitForFunction(() => document.getElementById('dragonVideo').currentTime > .1);
    const media = await page.locator('#dragonVideo').evaluate(v => ({duration: v.duration, rate: v.playbackRate, src: decodeURI(v.currentSrc)}));
    const targetSeconds = side === 'P' ? 5.5 : media.duration;
    assert.ok(Math.abs(media.duration / media.rate - targetSeconds) < .02, JSON.stringify(media));
    assert.ok(media.src.endsWith(side === 'P' ? '/特效/dragon-long-v2.webm' : '/assets/dragons/dragon-gold-front-loop-6s.webm'), 'Use the selected complete clip');
    if (side === 'B') {
      assert.ok(Math.abs(media.duration - 6) < .1, 'Banker clip is approximately six seconds');
      await page.waitForFunction(() => document.getElementById('dragonOverlay').classList.contains('dragon-video-exit'), null, {timeout: 8000});
    }
    await page.waitForFunction(() => speedEvidence.ended, null, {timeout: 10000});
    const evidence = await page.evaluate(() => speedEvidence);
    assert.ok(Math.abs(evidence.elapsed - targetSeconds * 1000) < 350, JSON.stringify(evidence));
    assert.ok(Math.abs(evidence.lastTime - evidence.duration) < .02, 'Reach the last frame without cutting');
    await page.waitForFunction(() => {
      const overlay = document.getElementById('dragonOverlay');
      return !overlay.classList.contains('active') && !overlay.classList.contains('fading-out');
    });
    // The corner badge calls the public trigger, which previously armed a hard cutoff.
    await page.evaluate(() => {
      window.replayEnded = false;
      document.getElementById('dragonVideo').addEventListener('ended', () => { replayEnded = true; }, {once: true});
    });
    await page.click('#dragonCornerBadge');
    await page.waitForFunction(() => replayEnded, null, {timeout: 10000});
    await page.waitForFunction(() => !document.getElementById('dragonOverlay').classList.contains('fading-out'));
    results.push({side, ...evidence});
    }
    assert.deepEqual(errors, []);
    console.log('PASS: banker completes the six-second clip and exit; player completes at 5.5 seconds; both badge replays reach the end.', JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
