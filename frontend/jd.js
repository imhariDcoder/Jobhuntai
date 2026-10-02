const PROVIDER_STORAGE_KEY = "smartjobai_provider";
const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini" };
const ADDED_SKILLS_CATEGORY = "Additional Skills (self-reported)";

let lastResult = null; // { matched_keywords, missing_keywords, match_score, diffs, selected_bullets, honesty_note, profile_skills }
let selectedMissingKeywords = new Set();
let masterProfileSkills = [];
let tailoredSkills = [];

function apiKeyStorageKey(provider) {
  return `smartjobai_api_key_${provider}`;
}

function setStatus(elId, msg, isError = false) {
  const status = document.getElementById(elId);
  if (!status) return;
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
    chip.title = "Click if you actually have this skill to claim it";
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
  btn.textContent = `Claim ${n} keyword${n > 1 ? "s" : ""} & Add to Skills`;
}

function toggleMissingKeyword(kw) {
  if (selectedMissingKeywords.has(kw)) selectedMissingKeywords.delete(kw);
  else selectedMissingKeywords.add(kw);
  renderChips();
}

/* ============================================================= Tailored Skills Logic */
function renderTailoredSkills() {
  const container = document.getElementById("tailored-skills-list");
  if (!container) return;
  container.innerHTML = "";

  const categorySelect = document.getElementById("new-skill-category-select");
  const currentSelectedCategory = categorySelect.value;
  categorySelect.innerHTML = "";

  tailoredSkills.forEach((catObj, catIdx) => {
    // Add to category select
    const opt = document.createElement("option");
    opt.value = catObj.category;
    opt.textContent = catObj.category;
    categorySelect.appendChild(opt);

    // Build category box
    const box = document.createElement("div");
    box.className = "tailored-cat-box";

    const header = document.createElement("div");
    header.className = "tailored-cat-header";

    const title = document.createElement("span");
    title.className = "tailored-cat-title";
    title.textContent = catObj.category;

    const count = document.createElement("span");
    count.className = "tailored-cat-count";
    count.textContent = `${catObj.items.length} skill${catObj.items.length === 1 ? "" : "s"}`;

    header.appendChild(title);
    header.appendChild(count);
    box.appendChild(header);

    const chipsWrap = document.createElement("div");
    chipsWrap.className = "tailored-cat-chips";

    if (!catObj.items || catObj.items.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "tailored-cat-empty";
      emptyMsg.textContent = "No skills active (excluded from this resume)";
      chipsWrap.appendChild(emptyMsg);
    } else {
      catObj.items.forEach((item, itemIdx) => {
        const pill = document.createElement("span");
        pill.className = "tailored-skill-pill";

        const textSpan = document.createElement("span");
        textSpan.textContent = item;
        pill.appendChild(textSpan);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "skill-del-btn";
        delBtn.innerHTML = "&times;";
        delBtn.title = `Remove '${item}' from this tailored resume`;
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeSkillFromTailored(catIdx, itemIdx);
        });
        pill.appendChild(delBtn);

        chipsWrap.appendChild(pill);
      });
    }

    box.appendChild(chipsWrap);
    container.appendChild(box);
  });

  if (currentSelectedCategory && Array.from(categorySelect.options).some(o => o.value === currentSelectedCategory)) {
    categorySelect.value = currentSelectedCategory;
  }
}

function removeSkillFromTailored(catIdx, itemIdx) {
  if (!tailoredSkills[catIdx] || !tailoredSkills[catIdx].items) return;
  const removedName = tailoredSkills[catIdx].items[itemIdx];
  tailoredSkills[catIdx].items.splice(itemIdx, 1);
  renderTailoredSkills();
  setStatus("skills-sync-status", `Removed "${removedName}" from this tailored resume.`);
}

function addSkillToTailored(categoryName, skillName) {
  skillName = skillName.trim();
  if (!skillName) return;

  let targetCat = tailoredSkills.find(s => s.category.toLowerCase() === categoryName.toLowerCase());
  if (!targetCat) {
    targetCat = { category: categoryName, items: [] };
    tailoredSkills.push(targetCat);
  }

  const existingLower = new Set(targetCat.items.map(i => i.toLowerCase()));
  if (!existingLower.has(skillName.toLowerCase())) {
    targetCat.items.push(skillName);
    renderTailoredSkills();
    setStatus("skills-sync-status", `Added "${skillName}" to ${targetCat.category}.`);
  } else {
    setStatus("skills-sync-status", `"${skillName}" is already present in ${targetCat.category}.`, true);
  }
}

async function addSelectedKeywordsToSkills() {
  const btn = document.getElementById("add-keywords-btn");
  btn.disabled = true;
  setStatus("add-keywords-status", "Adding to your tailored skills & profile...");

  try {
    const toAdd = Array.from(selectedMissingKeywords);
    let category = tailoredSkills.find((s) => s.category === ADDED_SKILLS_CATEGORY);
    if (!category) {
      category = { category: ADDED_SKILLS_CATEGORY, items: [] };
      tailoredSkills.push(category);
    }
    const existingLower = new Set(category.items.map((i) => i.toLowerCase()));
    for (const kw of toAdd) {
      if (!existingLower.has(kw.toLowerCase())) category.items.push(kw);
    }
    renderTailoredSkills();

    // Also persist to profile
    const resp = await fetch("/api/profile");
    if (resp.ok) {
      const profile = await resp.json();
      let profCat = profile.skills.find((s) => s.category === ADDED_SKILLS_CATEGORY);
      if (!profCat) {
        profCat = { category: ADDED_SKILLS_CATEGORY, items: [] };
        profile.skills.push(profCat);
      }
      const profLower = new Set(profCat.items.map((i) => i.toLowerCase()));
      for (const kw of toAdd) {
        if (!profLower.has(kw.toLowerCase())) profCat.items.push(kw);
      }
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      masterProfileSkills = JSON.parse(JSON.stringify(profile.skills));
    }

    lastResult.missing_keywords = lastResult.missing_keywords.filter((k) => !toAdd.includes(k));
    lastResult.matched_keywords = [...lastResult.matched_keywords, ...toAdd];
    selectedMissingKeywords.clear();

    renderChips();
    updateScoreDisplay();
    setStatus(
      "add-keywords-status",
      `Added ${toAdd.length > 1 ? toAdd.length + " skills" : '"' + toAdd[0] + '"'} to active CV skills.`
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

  // Initialize master profile skills and editable tailored skills
  masterProfileSkills = JSON.parse(JSON.stringify(data.profile_skills || []));
  tailoredSkills = JSON.parse(JSON.stringify(data.profile_skills || []));

  updateScoreDisplay();
  renderChips();
  renderTailoredSkills();

  // Render Interview Honesty Advisory
  const honestyHeader = document.getElementById("honesty-section-header");
  const honestyCard = document.getElementById("honesty-card");
  const honestyText = document.getElementById("honesty-text");
  if (data.honesty_note) {
    honestyText.textContent = data.honesty_note;
    honestyCard.style.display = "block";
    honestyHeader.style.display = "flex";
  } else {
    honestyCard.style.display = "none";
    honestyHeader.style.display = "none";
  }

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

  const toggleBtn = document.getElementById("toggle-api-key");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = apiKeyInput.type === "password";
      apiKeyInput.type = isPassword ? "text" : "password";
      toggleBtn.innerHTML = isPassword
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  const sampleJdBtn = document.getElementById("load-sample-jd");
  if (sampleJdBtn) {
    sampleJdBtn.addEventListener("click", () => {
      const sampleText = `Role: Senior Data Analyst / Business Intelligence Specialist\n\n` +
        `About the Role:\n` +
        `We are looking for a Data Analyst to join our Analytics team. You will lead exploratory data analysis (EDA), engineer SQL queries, build executive BI dashboards, and uncover data-driven insights that directly influence company strategy.\n\n` +
        `Key Responsibilities:\n` +
        `• Perform exploratory data analysis (EDA) on high-volume transactional and customer behavior datasets.\n` +
        `• Design, build, and maintain interactive dashboards in Power BI and Tableau for senior leadership.\n` +
        `• Write complex SQL queries for data extraction, manipulation, and performance optimization.\n` +
        `• Partner with cross-functional stakeholders to define, monitor, and optimize core business KPIs.\n` +
        `• Implement data validation checks and automated ETL workflows using Python.\n\n` +
        `Required Qualifications:\n` +
        `• Bachelor's degree in Computer Science, Data Science, Statistics, or related technical field.\n` +
        `• 1-3+ years of hands-on data analytics and business intelligence reporting experience.\n` +
        `• Proficiency in Python (pandas, numpy), SQL, and Excel.\n` +
        `• Demonstrated expertise in Power BI and Tableau (DAX, Power Query, drill-through reports).\n` +
        `• Strong analytical mindset with experience translating raw data into actionable recommendations.`;
      const jdField = document.getElementById("field-jd");
      jdField.value = sampleText;
      jdField.focus();
    });
  }

  // Skills management actions
  const addCustomSkillBtn = document.getElementById("add-custom-skill-btn");
  const newSkillInput = document.getElementById("new-skill-input");
  const newSkillCatSelect = document.getElementById("new-skill-category-select");

  if (addCustomSkillBtn && newSkillInput && newSkillCatSelect) {
    const handleAdd = () => {
      const val = newSkillInput.value.trim();
      const cat = newSkillCatSelect.value;
      if (val && cat) {
        addSkillToTailored(cat, val);
        newSkillInput.value = "";
      }
    };
    addCustomSkillBtn.addEventListener("click", handleAdd);
    newSkillInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    });
  }

  const resetSkillsBtn = document.getElementById("reset-skills-btn");
  if (resetSkillsBtn) {
    resetSkillsBtn.addEventListener("click", () => {
      tailoredSkills = JSON.parse(JSON.stringify(masterProfileSkills));
      renderTailoredSkills();
      setStatus("skills-sync-status", "Reset skills back to your original profile.");
    });
  }

  const saveMasterSkillsBtn = document.getElementById("save-master-skills-btn");
  if (saveMasterSkillsBtn) {
    saveMasterSkillsBtn.addEventListener("click", async () => {
      saveMasterSkillsBtn.disabled = true;
      setStatus("skills-sync-status", "Saving to master profile...");
      try {
        const resp = await fetch("/api/profile");
        if (!resp.ok) throw new Error(await resp.text());
        const profile = await resp.json();
        profile.skills = JSON.parse(JSON.stringify(tailoredSkills));
        const putResp = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        if (!putResp.ok) throw new Error(await putResp.text());
        masterProfileSkills = JSON.parse(JSON.stringify(tailoredSkills));
        setStatus("skills-sync-status", "Saved active skills to your master profile.");
      } catch (err) {
        setStatus("skills-sync-status", "Failed to save: " + err.message, true);
      } finally {
        saveMasterSkillsBtn.disabled = false;
      }
    });
  }

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
        body: JSON.stringify({
          selected_bullets: lastResult.selected_bullets,
          tailored_skills: tailoredSkills,
        }),
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
