// Shared frontend logic for every theme draft.
// Talks to the Litestar backend on the same origin (relative URLs).
//
// API contract:
//   POST /api/sentence {sentence, username?}
//        -> {message}                              when the sentence is UNIQUE ("win")
//        -> {message, number_other_submissions}    when it already existed ("lose")
//   GET  /api/sentence-count    -> {count}   total unique sentences in the db
//   GET  /api/submission-count  -> {count}   total submissions across all sentences
//
// EVERY page provides the same five element ids:
//   #form  #username  #sentence  #submit  #result
// ...and calls renderApp() once. The look is 100% CSS per page; this file only
// fills #result with a standard structure and toggles a state class on it:
//   class "win"  | "lose" | "pending"  (plus "show" once there's content)

const API = {
  async check(sentence, username) {
    const res = await fetch("/api/sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence, username: username || null }),
    });
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    return res.json();
  },
  async sentenceCount() {
    const res = await fetch("/api/sentence-count");
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    return (await res.json()).count;
  },
  async submissionCount() {
    const res = await fetch("/api/submission-count");
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    return (await res.json()).count;
  },
  // Recent submissions for the idle feed. This endpoint does not exist on the
  // backend yet (see BACKEND_NOTES.md §4) — when it 404s we fall back to sample
  // data so the page still looks alive in dev.
  async recent(limit = 12) {
    const res = await fetch(`/api/recent?limit=${limit}`);
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    return res.json(); // expected: [{sentence, username, count, awarded}]
  },
};

// Used only when /api/recent isn't available yet.
const SAMPLE_RECENT = [
  { sentence: "the moon tastes faintly of forgotten birthdays", username: "lyra", count: 1 },
  { sentence: "i alphabetized my regrets and started over", username: "anon", count: 3 },
  { sentence: "every escalator is just a staircase having a good day", username: "doug", count: 1 },
  { sentence: "my houseplant has opinions about my posture", username: "fern", count: 2 },
  { sentence: "we are all just weather that learned to worry", username: "marlowe", count: 1 },
  { sentence: "the printer knows what i did", username: "anon", count: 7 },
  { sentence: "somewhere a clock is bragging about being right twice", username: "kit", count: 1 },
  { sentence: "i named my fear and now it has a LinkedIn", username: "june", count: 4 },
  { sentence: "the ocean is just sky that gave up flying", username: "anon", count: 1 },
  { sentence: "all maps are confessions, if you fold them right", username: "wren", count: 2 },
];

const isUnique = (r) => r.number_other_submissions == null;

const QUIPS = {
  win: [
    "A genuine first. The corpus has never seen this one.",
    "Original! You just expanded the universe of things said.",
    "Nobody beat you to it. Certified fresh.",
  ],
  lose: [
    "Someone got there first, I'm afraid.",
    "Great minds... this one's been said before.",
    "Not as original as you hoped, huh?",
  ],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function wireForm({ onPending, onResult, onError }) {
  const form = document.getElementById("form");
  const submit = document.getElementById("submit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sentence = document.getElementById("sentence").value.trim();
    const username = document.getElementById("username").value.trim();
    if (!sentence) return;
    submit.disabled = true;
    onPending && onPending();
    try {
      const r = await API.check(sentence, username);
      const unique = isUnique(r);
      let totals = null;
      if (unique) {
        // Per-user count isn't exposed by the backend yet (see BACKEND_NOTES.md),
        // so a win shows the corpus totals.
        const [uniqueCount, submissionCount] = await Promise.all([
          API.sentenceCount(),
          API.submissionCount(),
        ]);
        totals = { uniqueCount, submissionCount };
      }
      onResult({
        unique,
        message: r.message || pick(unique ? QUIPS.win : QUIPS.lose),
        others: r.number_other_submissions,
        totals,
      });
    } catch (err) {
      onError ? onError(err) : alert(err.message);
    } finally {
      submit.disabled = false;
    }
  });
}

// Three-zone renderer: writes stats into #stats (middle third) and the verdict +
// quip into #answer (bottom third), and toggles a state class on <body>
// (state-win / state-lose) so the page can tint its accent.
function renderThirds(opts = {}) {
  const L = Object.assign(
    {
      pending: "checking the corpus…",
      win: "ORIGINAL",
      lose: "ALREADY SAID",
      error: "ERROR",
      uniqueLabel: "unique sentences in the corpus",
      totalLabel: "total submissions ever",
      priorLabel: "times said before",
    },
    opts.labels || {}
  );
  const statsEl = document.getElementById("stats");
  const answerEl = document.getElementById("answer");
  const setState = (cls) => {
    document.body.classList.remove("state-win", "state-lose");
    if (cls) document.body.classList.add(cls);
  };
  const statBlock = (n, l) =>
    `<div class="stat"><div class="num">${n}</div><div class="lbl">${esc(l)}</div></div>`;

  // Populate the idle middle-third with a scrolling feed of recent submissions,
  // styled like an old search-engine results page. Clicking one drops it into
  // the search box (interactive, no framework needed).
  if (opts.idleFeed) renderRecentFeed(statsEl);

  wireForm({
    onPending: () => {
      setState();
      statsEl.innerHTML = `<div class="muted">${esc(L.pending)}</div>`;
      answerEl.innerHTML = "";
    },
    onError: (e) => {
      setState("state-lose");
      statsEl.innerHTML = "";
      answerEl.innerHTML =
        `<div class="verdict">${esc(L.error)}</div><div class="quip">${esc(e.message)}</div>`;
    },
    onResult: (r) => {
      if (r.unique) {
        setState("state-win");
        statsEl.innerHTML =
          statBlock(r.totals.uniqueCount, L.uniqueLabel) +
          statBlock(r.totals.submissionCount, L.totalLabel);
        answerEl.innerHTML =
          `<div class="verdict">${esc(L.win)}</div><div class="quip">${esc(r.message)}</div>`;
      } else {
        setState("state-lose");
        statsEl.innerHTML = statBlock(r.others, L.priorLabel);
        answerEl.innerHTML =
          `<div class="verdict">${esc(L.lose)}</div><div class="quip">${esc(r.message)}</div>`;
      }
    },
  });
}

// Builds the scrolling "recently said" feed inside the given element.
// Falls back to SAMPLE_RECENT if /api/recent isn't live yet.
async function renderRecentFeed(statsEl) {
  let items;
  try {
    items = await API.recent(12);
    if (!Array.isArray(items) || !items.length) items = SAMPLE_RECENT;
  } catch (_) {
    items = SAMPLE_RECENT; // endpoint not built yet — see BACKEND_NOTES.md §4
  }

  const times = (n) =>
    n > 1 ? `said ${n} times` : "a genuine original";
  const row = (it) => {
    const who = it.username ? esc(it.username) : "some traveler";
    return (
      `<div class="result">` +
      `<span class="r-link" data-s="${esc(it.sentence)}">${esc(it.sentence)}</span>` +
      `<div class="r-meta">&mdash; ${who} <b>&middot; ${esc(times(it.count || 1))}</b></div>` +
      `</div>`
    );
  };

  // Duplicate the list so the CSS translateY(-50%) loop is seamless.
  const rows = items.map(row).join("");
  statsEl.innerHTML =
    `<div class="ticker"><div class="ticker-track">${rows}${rows}</div></div>`;

  // Click a recent sentence to borrow it into the search box.
  const input = document.getElementById("sentence");
  statsEl.querySelectorAll(".r-link").forEach((el) => {
    el.addEventListener("click", () => {
      el.classList.add("seen");
      if (input) {
        input.value = el.dataset.s;
        input.focus();
      }
    });
  });
}

// The one renderer every theme uses. Pass {labels:{...}} to flavor the words.
function renderApp(opts = {}) {
  const L = Object.assign(
    {
      pending: "Checking the corpus…",
      win: "ORIGINAL",
      lose: "ALREADY SAID",
      error: "ERROR",
      uniqueLabel: "unique sentences in the corpus",
      totalLabel: "total submissions ever",
      priorLabel: "times said before",
    },
    opts.labels || {}
  );
  const result = document.getElementById("result");
  const stat = (n, l) =>
    `<div class="r-stat"><span class="r-num">${n}</span><span class="r-label">${l}</span></div>`;

  wireForm({
    onPending: () => {
      result.className = "result show pending";
      result.innerHTML = `<div class="r-pending">${esc(L.pending)}</div>`;
    },
    onError: (e) => {
      result.className = "result show lose";
      result.innerHTML =
        `<div class="r-verdict">${esc(L.error)}</div>` +
        `<div class="r-quip">${esc(e.message)}</div>`;
    },
    onResult: (r) => {
      if (r.unique) {
        result.className = "result show win";
        result.innerHTML =
          `<div class="r-verdict">${esc(L.win)}</div>` +
          `<div class="r-quip">${esc(r.message)}</div>` +
          `<div class="r-stats">${stat(r.totals.uniqueCount, L.uniqueLabel)}${stat(
            r.totals.submissionCount,
            L.totalLabel
          )}</div>`;
      } else {
        result.className = "result show lose";
        result.innerHTML =
          `<div class="r-verdict">${esc(L.lose)}</div>` +
          `<div class="r-quip">${esc(r.message)}</div>` +
          `<div class="r-stats">${stat(r.others, L.priorLabel)}</div>`;
      }
    },
  });
}
