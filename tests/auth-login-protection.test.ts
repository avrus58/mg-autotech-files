import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_LOGIN_FAILURE_THRESHOLD,
  AUTH_LOGIN_FAILURE_WINDOW_MS,
  EMPTY_AUTH_LOGIN_FAILURE_STATE,
  authLoginNeedsVisibleChallenge,
  clearAuthLoginFailures,
  getAuthLoginFailureWindowRemaining,
  isInvalidPasswordCredentialError,
  readAuthLoginFailureState,
  recordAuthLoginFailure,
} from "../src/lib/authLoginProtection";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  snapshot() {
    return [...this.values.values()];
  }
}

test("visible Turnstile escalation starts on the fifth consecutive credential failure", () => {
  const storage = new MemoryStorage();
  const now = Date.UTC(2026, 7, 22, 12);
  let state = EMPTY_AUTH_LOGIN_FAILURE_STATE;

  for (let attempt = 1; attempt <= AUTH_LOGIN_FAILURE_THRESHOLD; attempt += 1) {
    state = recordAuthLoginFailure(storage, state, now + attempt);
    assert.equal(state.failures, attempt);
    assert.equal(
      authLoginNeedsVisibleChallenge(state.failures),
      attempt === AUTH_LOGIN_FAILURE_THRESHOLD
    );
  }

  assert.equal(recordAuthLoginFailure(storage, state, now + 10).failures, 5);
  assert.equal(storage.snapshot().some((value) => /@|password|token/i.test(value)), false);
});

test("the failure window expires and successful login clears the browser counter", () => {
  const storage = new MemoryStorage();
  const now = Date.UTC(2026, 7, 22, 12);
  const state = recordAuthLoginFailure(
    storage,
    EMPTY_AUTH_LOGIN_FAILURE_STATE,
    now
  );

  assert.equal(readAuthLoginFailureState(storage, now + 1).failures, 1);
  assert.equal(
    getAuthLoginFailureWindowRemaining(state, now + 1),
    AUTH_LOGIN_FAILURE_WINDOW_MS - 1
  );
  assert.equal(
    readAuthLoginFailureState(
      storage,
      now + AUTH_LOGIN_FAILURE_WINDOW_MS + 1
    ).failures,
    0
  );

  clearAuthLoginFailures(storage);
  assert.equal(readAuthLoginFailureState(storage, now + 1).failures, 0);
});

test("the fifteen-minute window is fixed from the first failure, not sliding", () => {
  const storage = new MemoryStorage();
  const now = Date.UTC(2026, 7, 22, 12);
  let state = EMPTY_AUTH_LOGIN_FAILURE_STATE;
  const observed: number[] = [];

  for (const minutes of [0, 14, 28, 42, 56]) {
    state = recordAuthLoginFailure(
      storage,
      state,
      now + minutes * 60 * 1_000
    );
    observed.push(state.failures);
  }

  assert.deepEqual(observed, [1, 2, 1, 2, 1]);
  assert.equal(authLoginNeedsVisibleChallenge(state.failures), false);
});

test("only invalid password credential responses increment the adaptive counter", () => {
  assert.equal(
    isInvalidPasswordCredentialError({ code: "invalid_credentials" }),
    true
  );
  assert.equal(
    isInvalidPasswordCredentialError({ message: "Invalid login credentials" }),
    true
  );
  assert.equal(
    isInvalidPasswordCredentialError({ code: "email_not_confirmed" }),
    false
  );
  assert.equal(
    isInvalidPasswordCredentialError({ message: "Network request failed" }),
    false
  );
  assert.equal(isInvalidPasswordCredentialError(null), false);
});

test("unavailable browser storage still escalates with the in-memory count", () => {
  let state = EMPTY_AUTH_LOGIN_FAILURE_STATE;
  for (let attempt = 0; attempt < AUTH_LOGIN_FAILURE_THRESHOLD; attempt += 1) {
    state = recordAuthLoginFailure(null, state);
  }
  assert.equal(authLoginNeedsVisibleChallenge(state.failures), true);
});
