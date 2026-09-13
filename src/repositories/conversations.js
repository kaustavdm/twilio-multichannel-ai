// In-memory conversation store shared between the agent runtime and the dashboard.
// No persistence: state is lost on process restart, which is fine for the demo.

const conversations = new Map();

function nowIso() {
  return new Date().toISOString();
}

function newRecord(convId, context) {
  return {
    id: convId,
    channel: context?.channel ?? context?.channelType ?? 'unknown',
    profileId: context?.profileId ?? undefined,
    startedAt: nowIso(),
    endedAt: null,
    status: 'active',
    transcript: [],
    toolEvents: [],
  };
}

export function ensureDashboardConversation(convId, context, memoryResponse) {
  let record = conversations.get(convId);
  if (!record) {
    record = newRecord(convId, context ?? {});
    conversations.set(convId, record);
  }
  if (!record.profileId && context?.profileId) {
    record.profileId = context.profileId;
  }
  if (memoryResponse !== undefined) {
    record.memory = memoryResponse;
  }
  return record;
}

export function addTranscriptTurn(convId, role, text) {
  if (!text) return;
  const record = conversations.get(convId);
  if (!record) return;
  record.transcript.push({ at: nowIso(), role, text });
}

export function addToolEvent(convId, name, args, result) {
  const record = conversations.get(convId);
  if (!record) return;
  record.toolEvents.push({ at: nowIso(), name, args, result });
}

export function markConversationEnded(convId) {
  const record = conversations.get(convId);
  if (!record) return;
  record.endedAt = nowIso();
  record.status = 'ended';
}

export function listConversations() {
  return [...conversations.values()].sort((a, b) => {
    const aKey = a.endedAt ?? a.startedAt;
    const bKey = b.endedAt ?? b.startedAt;
    return bKey.localeCompare(aKey);
  });
}

export function getConversation(convId) {
  return conversations.get(convId);
}
