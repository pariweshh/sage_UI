// Standalone self-check for the pure wake-word matcher (no test framework).
// Run: node_modules/.bin/tsx wake.selfcheck.ts  (or from ../sage: node_modules/.bin/tsx ../sage-ui/wake.selfcheck.ts)
// Not part of the app: it lives outside src/, so the Vite build and tsc -b ignore it.
import assert from 'node:assert/strict';
import { matchWake } from './src/conversation';

const WW = ['sage'];

// No wake word -> miss (utterance not addressed to the assistant).
assert.equal(matchWake('what time is it', WW).hit, false);

// Wake word + question -> hit, wake word stripped.
{
  const m = matchWake('Sage, what is on my calendar', WW);
  assert.equal(m.hit, true);
  assert.equal(m.remainder, 'what is on my calendar');
}

// A short lead-in before the wake word is allowed.
{
  const m = matchWake('hey sage what time is it', WW);
  assert.equal(m.hit, true);
  assert.equal(m.remainder, 'what time is it');
}

// Only the wake word -> hit with empty remainder (attention: open the window and wait).
{
  const m = matchWake('Sage.', WW);
  assert.equal(m.hit, true);
  assert.equal(m.remainder, '');
}

// The wake word must be near the start, not buried mid-sentence.
assert.equal(matchWake('I was talking to my friend about sage advice today', WW).hit, false);

// Whole-word only: "sagely" is not "sage".
assert.equal(matchWake('sagely nod', WW).hit, false);

// Accepted variant (mishear).
{
  const m = matchWake('sange what is up', ['sage', 'sange']);
  assert.equal(m.hit, true);
  assert.equal(m.remainder, 'what is up');
}

// Multi-word wake phrase.
{
  const m = matchWake('hey computer, lights on', ['hey computer']);
  assert.equal(m.hit, true);
  assert.equal(m.remainder, 'lights on');
}

console.log('wake self-check: PASS');
