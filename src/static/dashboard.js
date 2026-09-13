let selectedId = null;
let currentConversations = [];

const fmtTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function statusLabel(status) {
  if (status === 'ended') return 'ended';
  if (status === 'active') return 'active';
  return status || 'active';
}

function renderList(conversations) {
  const list = document.getElementById('conversationList');
  list.replaceChildren();
  if (!conversations.length) {
    list.appendChild(el('div', 'muted empty-note', 'No conversations yet.'));
    return;
  }
  if (!selectedId || !conversations.some((c) => c.id === selectedId)) {
    selectedId = conversations[0].id;
  }
  for (const conv of conversations) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'conv-btn';
    if (conv.id === selectedId) btn.classList.add('active');
    if (conv.status === 'ended') btn.classList.add('ended');
    btn.dataset.id = conv.id;

    btn.appendChild(el('div', 'conv-id', conv.id));

    const meta = el('div', 'conv-meta');
    const statusBadge = el('span', `badge ${conv.status === 'ended' ? 'ended' : 'active'}`, statusLabel(conv.status));
    meta.appendChild(statusBadge);
    if (conv.channel) meta.appendChild(el('span', 'badge channel', String(conv.channel)));
    const started = fmtTime(conv.startedAt);
    if (started) meta.appendChild(el('span', null, started));
    btn.appendChild(meta);

    btn.addEventListener('click', () => {
      selectedId = conv.id;
      renderList(currentConversations);
      loadSelected();
    });
    list.appendChild(btn);
  }
}

function renderTranscript(conversation) {
  const container = document.getElementById('transcript');
  container.replaceChildren();
  const turns = conversation.transcript || [];
  if (!turns.length) {
    container.appendChild(el('div', 'empty', 'Caller and agent turns will appear here.'));
    return;
  }
  for (const turn of turns) {
    const role = turn.role === 'agent' ? 'agent' : 'caller';
    const article = document.createElement('article');
    article.className = `turn ${role}`;
    const time = fmtTime(turn.at);
    article.appendChild(el('div', 'speaker', time ? `${role} - ${time}` : role));
    article.appendChild(el('div', 'bubble', turn.text || ''));
    container.appendChild(article);
  }
  container.scrollTop = container.scrollHeight;
}

function renderToolEvents(conversation) {
  const container = document.getElementById('toolEvents');
  container.replaceChildren();
  const events = conversation.toolEvents || [];
  if (!events.length) {
    container.appendChild(el('div', 'muted empty-note', 'No tool events yet.'));
    return;
  }
  for (const event of events) {
    const wrap = el('div', 'tool-event');
    const head = document.createElement('div');
    head.appendChild(el('span', 'name', event.name || 'unnamed_tool'));
    const at = fmtTime(event.at);
    if (at) {
      head.appendChild(document.createTextNode(' '));
      head.appendChild(el('span', 'at', `- ${at}`));
    }
    wrap.appendChild(head);

    if (event.args && Object.keys(event.args).length) {
      wrap.appendChild(el('div', 'label', 'Args'));
      wrap.appendChild(el('pre', null, safeStringify(event.args)));
    }
    if (event.result !== undefined && event.result !== null) {
      wrap.appendChild(el('div', 'label', 'Result'));
      wrap.appendChild(el('pre', null, safeStringify(event.result)));
    }
    container.appendChild(wrap);
  }
}

function safeStringify(value) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderConversation(conversation) {
  document.getElementById('conversationTitle').textContent = conversation.id;
  const status = document.getElementById('conversationStatus');
  const parts = [statusLabel(conversation.status)];
  if (conversation.channel) parts.push(String(conversation.channel));
  const started = fmtTime(conversation.startedAt);
  if (started) parts.push(`started ${started}`);
  status.textContent = parts.join(' - ');

  const last = document.getElementById('lastUpdated');
  last.textContent = `Updated ${fmtTime(new Date().toISOString())}`;

  renderTranscript(conversation);
  renderToolEvents(conversation);
}

function clearConversation() {
  document.getElementById('conversationTitle').textContent = 'Select a conversation';
  document.getElementById('conversationStatus').textContent = '';
  document.getElementById('transcript').replaceChildren(
    el('div', 'empty', 'Caller and agent turns will appear here.'),
  );
  document.getElementById('toolEvents').replaceChildren(
    el('div', 'muted empty-note', 'No tool events yet.'),
  );
}

async function loadSelected() {
  if (!selectedId) {
    clearConversation();
    return;
  }
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(selectedId)}`);
    if (!res.ok) {
      clearConversation();
      return;
    }
    const conv = await res.json();
    renderConversation(conv);
  } catch {
    // Network hiccup; leave last render.
  }
}

async function refresh() {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    currentConversations = Array.isArray(data.conversations) ? data.conversations : [];
    renderList(currentConversations);
    if (currentConversations.length) {
      await loadSelected();
    } else {
      clearConversation();
    }
  } catch {
    // Retain last-known state on transient errors.
  }
}

refresh();
setInterval(refresh, 3000);
