const PROVIDER_STORAGE_KEY = "smartjobai_provider";
const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini" };
const ADDED_SKILLS_CATEGORY = "Additional Skills (self-reported)";

let lastResult = null; // { matched_keywords, missing_keywords, match_score, diffs, selected_bullets }
let selectedMissingKeywords = new Set();

function apiKeyStorageKey(provider) {
  return `smartjobai_api_key_${provider}`;
}

function setStatus(elId, msg, isError = false) {
  const status = document.getElementById(elId);
  status.textContent = msg;
  status.classList.toggle("error", isError);
  status.classList.toggle("success", !isError && msg.length > 0);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeywords(text, keywords) {
  if (!keywords.length) return document.createTextNode(text);
  const pattern = keywords.map(escapeRegExp).filter(Boolean).join("|");
  if (!pattern) return document.createTextNode(text);
  const re = new RegExp(`(${pattern})`, "gi");
  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const mark = document.createElement("mark");
    mark.textContent = match[0];
    frag.appendChild(mark);
    lastIndex = match.index + match[0].length;
  }
  frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  return frag;
}

function renderChips() {
  const matchedContainer = document.getElementById("matched-chips");
  matchedContainer.innerHTML = "";
  for (const kw of lastResult.matched_keywords) {
    const chip = document.createElement("span");
    chip.className = "chip matched";
    chip.textContent = `✓ ${kw}`;
    matchedContainer.appendChild(chip);
  }

  const missingContainer = document.getElementById("missing-chips");
  missingContainer.innerHTML = "";
  for (const kw of lastResult.missing_keywords) {
    const chip = document.createElement("span");
    chip.className = "chip missing selectable";
    if (selectedMissingKeywords.has(kw)) chip.classList.add("selected");
    chip.textContent = selectedMissingKeywords.has(kw) ? `✓ ${kw}` : kw;
    chip.title = "Click if you actually have this skill";
    chip.addEventListener("click", () => toggleMissingKeyword(kw));
    missingContainer.appendChild(chip);
  }

  const missingNote = document.getElementById("missing-note");
  missingNote.textContent = lastResult.missing_keywords.length
    ? "The keywords above aren't in your stored profile."
    : "Your profile covers every keyword extracted from this job description.";

  updateAddKeywordsBar();
}

function updateScoreDisplay() {
  const jdTotal = lastResult.matched_keywords.length + lastResult.missing_keywords.length;
  const pct = jdTotal ? Math.round((lastResult.matched_keywords.length / jdTotal) * 100) : 0;
  document.getElementById("score-value").textContent = `${pct}%`;
  document.getElementById("score-bar").style.width = `${pct}%`;
}

function updateAddKeywordsBar() {
  const bar = document.getElementById("add-keywords-bar");
  const btn = document.getElementById("add-keywords-btn");
  const n = selectedMissingKeywords.size;
  if (n === 0) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "block";
  btn.textContent = `Add ${n} keyword${n > 1 ? "s" : ""} to your Skills`;
}

function toggleMissingKeyword(kw) {
  if (selectedMissingKeywords.has(kw)) selectedMissingKeywords.delete(kw);
  else selectedMissingKeywords.add(kw);
  renderChips();
}

async function addSelectedKeywordsToSkills() {
  const btn = document.getElementById("add-keywords-btn");
  btn.disabled = true;
  setStatus("add-keywords-status", "Adding to your profile...");

  try {
    const toAdd = Array.from(selectedMissingKeywords);
    const resp = await fetch("/api/profile");
    if (!resp.ok) throw new Error(await resp.text());
    const profile = await resp.json();

    let category = profile.skills.find((s) => s.category === ADDED_SKILLS_CATEGORY);
    if (!category) {
      category = { category: ADDED_SKILLS_CATEGORY, items: [] };
      profile.skills.push(category);
    }
    const existingLower = new Set(category.items.map((i) => i.toLowerCase()));
    for (const kw of toAdd) {
      if (!existingLower.has(kw.toLowerCase())) category.items.push(kw);
    }

    const putResp = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!putResp.ok) throw new Error(await putResp.text());

    // We know exactly which keywords we just confirmed -- move them from
    // missing to matched locally rather than re-running the LLM call.
    lastResult.missing_keywords = lastResult.missing_keywords.filter((k) => !toAdd.includes(k));
    lastResult.matched_keywords = [...lastResult.matched_keywords, ...toAdd];
    selectedMissingKeywords.clear();

    renderChips();
    updateScoreDisplay();
    setStatus(
      "add-keywords-status",
      `Added to your Skills (saved). Preview PDF again to include ${toAdd.length > 1 ? "them" : "it"}.`
    );
  } catch (err) {
    setStatus("add-keywords-status", "Error: " + err.message, true);
  } finally {
    btn.disabled = false;
  }
}

function renderResults(data) {
  lastResult = data;
  selectedMissingKeywords.clear();

  updateScoreDisplay();
  renderChips();

  const diffsList = document.getElementById("diffs-list");
  const noDiffsMessage = document.getElementById("no-diffs-message");
  diffsList.innerHTML = "";

  if (!data.diffs.length) {
    noDiffsMessage.style.display = "block";
  } else {
    noDiffsMessage.style.display = "none";
    for (const diff of data.diffs) {
      const card = document.createElement("div");
      card.className = "card diff-card";

      const label = document.createElement("div");
      label.className = "diff-entry-label";
      label.textContent = diff.entry_label;
      card.appendChild(label);

      const original = document.createElement("div");
      original.className = "diff-original";
      original.textContent = diff.original_text;
      card.appendChild(original);

      const arrow = document.createElement("div");
      arrow.className = "diff-arrow";
      arrow.textContent = "↓ tailored to this job";
      card.appendChild(arrow);

      const rewritten = document.createElement("div");
      rewritten.className = "diff-rewritten";
      rewritten.appendChild(highlightKeywords(diff.rewritten_text, data.matched_keywords));
      card.appendChild(rewritten);

      diffsList.appendChild(card);
    }
  }

  document.getElementById("results").style.display = "block";
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("DOMContentLoaded", () => {
  const providerSelect = document.getElementById("field-provider");
  const apiKeyInput = document.getElementById("field-api-key");

  const savedProvider = sessionStorage.getItem(PROVIDER_STORAGE_KEY);
  if (savedProvider) providerSelect.value = savedProvider;

  function loadKeyForCurrentProvider() {
    const saved = sessionStorage.getItem(apiKeyStorageKey(providerSelect.value));
    apiKeyInput.value = saved || "";
  }
  loadKeyForCurrentProvider();

  providerSelect.addEventListener("change", () => {
    sessionStorage.setItem(PROVIDER_STORAGE_KEY, providerSelect.value);
    loadKeyForCurrentProvider();
  });

  apiKeyInput.addEventListener("input", (e) => {
    sessionStorage.setItem(apiKeyStorageKey(providerSelect.value), e.target.value);
  });

  document.getElementById("add-keywords-btn").addEventListener("click", addSelectedKeywordsToSkills);

  document.getElementById("jd-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const jdText = document.getElementById("field-jd").value.trim();
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      setStatus("status", `Enter your ${PROVIDER_LABELS[provider]} API key first.`, true);
      return;
    }
    if (!jdText) {
      setStatus("status", "Paste a job description first.", true);
      return;
    }

    const btn = document.getElementById("preview-btn");
    btn.disabled = true;
    document.getElementById("results").style.display = "none";
    showProgress("status", [
      `Extracting keywords with ${PROVIDER_LABELS[provider]}...`,
      "Matching keywords to your experience...",
      "Selecting and rewording the best-fit bullets...",
      "Almost done...",
    ]);

    try {
      const resp = await fetch("/api/resume/tailor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_text: jdText, provider, api_key: apiKey }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${resp.status})`);
      }
      const data = await resp.json();
      hideProgress("status");
      renderResults(data);
      setStatus("status", "Preview ready -- review the changes below.");
    } catch (err) {
      hideProgress("status");
      setStatus("status", "Error: " + err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("preview-pdf-btn").addEventListener("click", async () => {
    if (!lastResult) return;
    const btn = document.getElementById("preview-pdf-btn");
    btn.disabled = true;
    showProgress("download-status", ["Rendering PDF..."]);

    try {
      const resp = await fetch("/api/resume/tailor/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_bullets: lastResult.selected_bullets }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${resp.status})`);
      }
      const blob = await resp.blob();
      hideProgress("download-status");
      showPdfPreview(blob, "resume_tailored.pdf");
      setStatus("download-status", "Preview ready.");
    } catch (err) {
      hideProgress("download-status");
      setStatus("download-status", "Error: " + err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
});
