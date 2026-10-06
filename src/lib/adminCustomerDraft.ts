export type AdminCustomerDraftIdentity = {
  customerId: string;
  instanceId: number;
};

export type AdminCustomerDraft<Form extends object> = AdminCustomerDraftIdentity & {
  baseline: Form;
  draft: Form;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
}

function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => equalValue(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length
      && keys.every((key) => Object.hasOwn(right, key) && equalValue(left[key], right[key]));
  }
  return false;
}

// Record-valued controls (package overrides) are reconciled per leaf. Arrays
// (customer tags) are one atomic field, never reordered or merged implicitly.
function reconcileValue(current: unknown, reference: unknown, confirmed: unknown): unknown {
  if (equalValue(current, reference)) return cloneValue(confirmed);
  if (isRecord(current) && isRecord(reference) && isRecord(confirmed)) {
    return Object.fromEntries(Object.entries(current).map(([key, value]) => [
      key,
      Object.hasOwn(reference, key) && Object.hasOwn(confirmed, key)
        ? reconcileValue(value, reference[key], confirmed[key])
        : cloneValue(value),
    ]));
  }
  return cloneValue(current);
}

export function cloneAdminCustomerDraftFields<Form extends object>(form: Form): Form {
  return cloneValue(form) as Form;
}

export function createAdminCustomerDraft<Form extends object>(
  identity: AdminCustomerDraftIdentity,
  form: Form,
): AdminCustomerDraft<Form> {
  return {
    ...identity,
    baseline: cloneAdminCustomerDraftFields(form),
    draft: cloneAdminCustomerDraftFields(form),
  };
}

export function isAdminCustomerDraftIdentity<Form extends object>(
  state: AdminCustomerDraft<Form> | null,
  identity: AdminCustomerDraftIdentity,
): state is AdminCustomerDraft<Form> {
  return state !== null && state.customerId === identity.customerId && state.instanceId === identity.instanceId;
}

export function editAdminCustomerDraft<Form extends object>(
  state: AdminCustomerDraft<Form>,
  draft: Form,
): AdminCustomerDraft<Form> {
  return { ...state, draft: cloneAdminCustomerDraftFields(draft) };
}

function acceptFields<Form extends object>(
  state: AdminCustomerDraft<Form>,
  reference: Partial<Form>,
  confirmed: Partial<Form>,
  keys: readonly (keyof Form)[],
): AdminCustomerDraft<Form> {
  const baseline = cloneAdminCustomerDraftFields(state.baseline);
  const draft = cloneAdminCustomerDraftFields(state.draft);
  for (const key of keys) {
    if (!Object.hasOwn(reference, key) || !Object.hasOwn(confirmed, key)) continue;
    draft[key] = reconcileValue(state.draft[key], reference[key], confirmed[key]) as Form[typeof key];
    baseline[key] = cloneValue(confirmed[key]) as Form[typeof key];
  }
  return { ...state, baseline, draft };
}

export function reconcileAdminCustomerDraftFields<Form extends object>(
  state: AdminCustomerDraft<Form>,
  identity: AdminCustomerDraftIdentity,
  remote: Partial<Form>,
  keys: readonly (keyof Form)[],
): AdminCustomerDraft<Form> {
  if (!isAdminCustomerDraftIdentity(state, identity)) return state;
  return acceptFields(state, state.baseline, remote, keys);
}

export function acceptAdminCustomerSubmittedFields<Form extends object>(
  state: AdminCustomerDraft<Form>,
  identity: AdminCustomerDraftIdentity,
  submitted: Partial<Form>,
  confirmed: Partial<Form>,
  keys: readonly (keyof Form)[],
): AdminCustomerDraft<Form> {
  if (!isAdminCustomerDraftIdentity(state, identity)) return state;
  return acceptFields(state, submitted, confirmed, keys);
}
