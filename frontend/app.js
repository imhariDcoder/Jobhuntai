let profileData = {
  name: "", phone: "", email: "", linkedin: "", github: "", location: "", summary: "",
  education: [], experience: [], projects: [], skills: [], certifications: [],
};

const HEADER_FIELDS = ["name", "phone", "email", "linkedin", "github", "location", "summary"];

let livePdfBlob = null;
let livePdfUrl = null;
let renderDebounceTimer = null;

function csvToList(s) {
  return (s || "").split(",").map((x) => x.trim()).filter(Boolean);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function getSmartPdfFilename() {
  let candidateName = "Resume";
  if (profileData && profileData.name) {
    const clean = profileData.name.trim().replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    if (clean) candidateName = clean;
  }
  return `${candidateName}_Resume.pdf`.replace(/__+/g, "_");
}

function updateSmartFilename() {
  const filename = getSmartPdfFilename();
  const label = document.getElementById("live-pdf-filename");
  if (label) label.textContent = filename;
}

function updatePageBudget() {
  const badge = document.getElementById("page-budget-badge");
  if (!badge) return;

  const totalSkills = (profileData.skills || []).reduce(
    (acc, c) => acc + (c.items ? c.items.length : 0),
    0
  );
  let totalBullets = 0;
  (profileData.experience || []).forEach((e) => {
    totalBullets += (e.bullets || []).length;
  });
  (profileData.projects || []).forEach((p) => {
    totalBullets += (p.bullets || []).length;
  });

  const skillsLines = (profileData.skills || []).length + Math.ceil(totalSkills / 3.5);
  const bulletLines = Math.round(totalBullets * 1.7);
  const eduLines = (profileData.education || []).length * 2.5;
  const certLines = (profileData.certifications || []).length * 1.2;
  const estimatedTotalLines = Math.round(7 + skillsLines + bulletLines + eduLines + certLines);

  if (estimatedTotalLines <= 36) {
    badge.className = "page-budget-badge optimal";
    badge.textContent = `✓ 1-Page Optimal (~${estimatedTotalLines} lines)`;
    badge.title = `Estimated ${estimatedTotalLines} lines total (${totalBullets} bullets, ${totalSkills} skills). Fits comfortably on 1 page.`;
  } else {
    badge.className = "page-budget-badge warning";
    badge.textContent = `⚠ Page 2 Spill Warning (~${estimatedTotalLines} lines)`;
    badge.title = `Estimated ${estimatedTotalLines} lines total. May spill onto page 2. Consider trimming bullets or skills for a tight 1-page resume.`;
  }
}

async function renderLivePdfPreview(silent = false) {
  const spinner = document.getElementById("live-pdf-spinner");
  const placeholder = document.getElementById("live-pdf-placeholder");
  const iframe = document.getElementById("live-pdf-iframe");
  const refreshBtn = document.getElementById("live-pdf-refresh-btn");

  if (!silent && spinner) spinner.style.display = "flex";
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const resp = await fetch("/api/resume/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    });
    if (!resp.ok) {
      throw new Error(`Compile failed (${resp.status})`);
    }
    const blob = await resp.blob();
    livePdfBlob = blob;

    if (livePdfUrl) URL.revokeObjectURL(livePdfUrl);
    livePdfUrl = URL.createObjectURL(blob);

    if (placeholder) placeholder.style.display = "none";
    if (iframe) {
      iframe.src = livePdfUrl + "#toolbar=0&navpanes=0";
      iframe.style.display = "block";
    }

    updateSmartFilename();
    updatePageBudget();
  } catch (err) {
    console.error("Live PDF render error:", err);
  } finally {
    if (spinner) spinner.style.display = "none";
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function queueLivePdfRender() {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  updateSmartFilename();
  updatePageBudget();
  renderDebounceTimer = setTimeout(() => {
    renderLivePdfPreview(true);
  }, 850);
}

function downloadCurrentMasterPdf() {
  if (!livePdfBlob) return;
  const filename = getSmartPdfFilename();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(livePdfBlob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function labeledInput(labelText, value, onInput, type = "text") {
  const wrap = el("div");
  wrap.appendChild(el("label", {}, [document.createTextNode(labelText)]));
  const input = el("input", { type });
  input.value = value || "";
  input.addEventListener("input", (e) => {
    onInput(e.target.value);
    queueLivePdfRender();
  });
  wrap.appendChild(input);
  return wrap;
}

function labeledTextarea(labelText, value, onInput) {
  const wrap = el("div");
  wrap.appendChild(el("label", {}, [document.createTextNode(labelText)]));
  const ta = el("textarea");
  ta.value = value || "";
  ta.addEventListener("input", (e) => {
    onInput(e.target.value);
    queueLivePdfRender();
  });
  wrap.appendChild(ta);
  return wrap;
}

function labeledSelect(labelText, value, options, onInput) {
  const wrap = el("div");
  wrap.appendChild(el("label", {}, [document.createTextNode(labelText)]));
  const select = el("select");
  for (const opt of options) {
    const o = el("option", { value: opt });
    o.textContent = opt;
    if (opt === value) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener("change", (e) => {
    onInput(e.target.value);
    queueLivePdfRender();
  });
  wrap.appendChild(select);
  return wrap;
}

function createRemoveButton(label, onClick) {
  const btn = el("button", { class: "remove", type: "button" });
  btn.textContent = "[ " + label.toLowerCase() + " ]";
  btn.addEventListener("click", onClick);
  return btn;
}

function bulletsEditor(bullets, onChange) {
  const container = el("div");

  function render() {
    container.innerHTML = "";
    bullets.forEach((b, i) => {
      const row = el("div", { class: "bullet-row" });
      const textArea = el("textarea", { placeholder: "Bullet accomplishment..." });
      textArea.value = b.text || "";
      textArea.addEventListener("input", (e) => {
        b.text = e.target.value;
        onChange();
        queueLivePdfRender();
      });

      const kwInput = el("input", { type: "text", placeholder: "skills, keywords (csv)" });
      kwInput.value = (b.keywords || []).join(", ");
      kwInput.addEventListener("input", (e) => {
        b.keywords = csvToList(e.target.value);
        onChange();
        queueLivePdfRender();
      });

      const removeBtn = el("button", { class: "remove", type: "button", title: "Remove bullet" });
      removeBtn.textContent = "[ × ]";
      removeBtn.addEventListener("click", () => {
        bullets.splice(i, 1);
        render();
        onChange();
        queueLivePdfRender();
      });

      row.appendChild(textArea);
      row.appendChild(kwInput);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });

    const addBtn = el("button", { class: "add", type: "button" });
    addBtn.textContent = "+ Add bullet point";
    addBtn.addEventListener("click", () => {
      bullets.push({ text: "", keywords: [] });
      render();
      onChange();
      queueLivePdfRender();
    });
    container.appendChild(addBtn);
  }

  render();
  return container;
}

function renderHeader() {
  for (const field of HEADER_FIELDS) {
    const input = document.getElementById("field-" + field);
    if (input) input.value = profileData[field] || "";
  }
}

function bindHeader() {
  for (const field of HEADER_FIELDS) {
    const input = document.getElementById("field-" + field);
    if (input) {
      input.addEventListener("input", (e) => {
        profileData[field] = e.target.value;
        if (field === "name") updateSmartFilename();
        queueLivePdfRender();
      });
    }
  }
}

function renderEducation() {
  const container = document.getElementById("education-list");
  container.innerHTML = "";
  profileData.education.forEach((edu, i) => {
    const entry = el("div", { class: "entry" });
    const row = el("div", { class: "row-2" });
    row.appendChild(labeledInput("Degree", edu.degree, (v) => (edu.degree = v)));
    row.appendChild(labeledInput("Dates", edu.dates, (v) => (edu.dates = v)));
    entry.appendChild(row);
    const row2 = el("div", { class: "row-2" });
    row2.appendChild(labeledInput("Institution", edu.org, (v) => (edu.org = v)));
    row2.appendChild(labeledInput("Location", edu.location, (v) => (edu.location = v)));
    entry.appendChild(row2);
    entry.appendChild(
      labeledTextarea("Details (one per line)", (edu.details || []).join("\n"), (v) => {
        edu.details = v.split("\n").map((x) => x.trim()).filter(Boolean);
      })
    );
    entry.appendChild(
      createRemoveButton("Remove education entry", () => {
        profileData.education.splice(i, 1);
        renderEducation();
        queueLivePdfRender();
      })
    );
    container.appendChild(entry);
  });
}

function renderExperience() {
  const container = document.getElementById("experience-list");
  container.innerHTML = "";
  profileData.experience.forEach((exp, i) => {
    const entry = el("div", { class: "entry" });
    const row = el("div", { class: "row-2" });
    row.appendChild(
      labeledSelect("Type", exp.type || "job", ["job", "training"], (v) => (exp.type = v))
    );
    row.appendChild(labeledInput("Dates", exp.dates, (v) => (exp.dates = v)));
    entry.appendChild(row);
    const row2 = el("div", { class: "row-2" });
    row2.appendChild(labeledInput("Role / Title", exp.role, (v) => (exp.role = v)));
    row2.appendChild(labeledInput("Organization", exp.org, (v) => (exp.org = v)));
    entry.appendChild(row2);
    entry.appendChild(labeledInput("Location", exp.location, (v) => (exp.location = v)));
    entry.appendChild(el("label", {}, [document.createTextNode("Bullets")]));
    entry.appendChild(bulletsEditor(exp.bullets, () => {}));
    entry.appendChild(
      createRemoveButton("Remove experience entry", () => {
        profileData.experience.splice(i, 1);
        renderExperience();
        queueLivePdfRender();
      })
    );
    container.appendChild(entry);
  });
}

function renderProjects() {
  const container = document.getElementById("projects-list");
  container.innerHTML = "";
  profileData.projects.forEach((proj, i) => {
    const entry = el("div", { class: "entry" });
    entry.appendChild(labeledInput("Title", proj.title, (v) => (proj.title = v)));
    const row = el("div", { class: "row-2" });
    row.appendChild(
      labeledInput("Tech (comma separated)", (proj.tech || []).join(", "), (v) => {
        proj.tech = csvToList(v);
      })
    );
    row.appendChild(labeledInput("Date", proj.date, (v) => (proj.date = v)));
    entry.appendChild(row);
    const row2 = el("div", { class: "row-2" });
    row2.appendChild(labeledInput("Link (optional)", proj.link, (v) => (proj.link = v)));
    row2.appendChild(
      labeledSelect(
        "Type",
        proj.type || "personal",
        ["personal", "academic", "professional"],
        (v) => (proj.type = v)
      )
    );
    entry.appendChild(row2);
    entry.appendChild(el("label", {}, [document.createTextNode("Bullets")]));
    entry.appendChild(bulletsEditor(proj.bullets, () => {}));
    entry.appendChild(
      createRemoveButton("Remove project", () => {
        profileData.projects.splice(i, 1);
        renderProjects();
        queueLivePdfRender();
      })
    );
    container.appendChild(entry);
  });
}

function renderSkills() {
  const container = document.getElementById("skills-list");
  container.innerHTML = "";
  profileData.skills.forEach((skill, i) => {
    const entry = el("div", { class: "entry" });
    const row = el("div", { class: "row-2" });
    row.appendChild(labeledInput("Category", skill.category, (v) => (skill.category = v)));
    row.appendChild(
      labeledInput("Items (comma separated)", (skill.items || []).join(", "), (v) => {
        skill.items = csvToList(v);
      })
    );
    entry.appendChild(row);
    entry.appendChild(
      createRemoveButton("Remove skill category", () => {
        profileData.skills.splice(i, 1);
        renderSkills();
        queueLivePdfRender();
      })
    );
    container.appendChild(entry);
  });
}

function renderCertifications() {
  const container = document.getElementById("certifications-list");
  container.innerHTML = "";
  profileData.certifications.forEach((cert, i) => {
    const entry = el("div", { class: "entry" });
    const row = el("div", { class: "row-2" });
    row.appendChild(labeledInput("Title", cert.title, (v) => (cert.title = v)));
    row.appendChild(labeledInput("Date", cert.date, (v) => (cert.date = v)));
    entry.appendChild(row);
    entry.appendChild(labeledInput("Issuing org", cert.org, (v) => (cert.org = v)));
    entry.appendChild(
      createRemoveButton("Remove certification", () => {
        profileData.certifications.splice(i, 1);
        renderCertifications();
        queueLivePdfRender();
      })
    );
    container.appendChild(entry);
  });
}

function renderAll() {
  renderHeader();
  renderEducation();
  renderExperience();
  renderProjects();
  renderSkills();
  renderCertifications();
}

async function loadProfile() {
  const resp = await fetch("/api/profile");
  profileData = await resp.json();
  renderAll();
  updateSmartFilename();
  updatePageBudget();
  renderLivePdfPreview(false);
}

function setStatus(msg, isError = false) {
  const status = document.getElementById("status");
  status.textContent = msg;
  status.classList.toggle("error", isError);
  status.classList.toggle("success", !isError && msg.length > 0);
}

async function saveProfile() {
  const resp = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileData),
  });
  if (!resp.ok) throw new Error(await resp.text());
  profileData = await resp.json();
  renderAll();
}

async function saveProfileOnly() {
  const btn = document.getElementById("save-profile");
  btn.disabled = true;
  setStatus("Saving...");
  try {
    await saveProfile();
    setStatus("Profile saved. It'll be used next time you tailor a resume.");
    renderLivePdfPreview(true);
  } catch (err) {
    setStatus("Error: " + err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function saveAndDownload() {
  showProgress("status", ["Saving profile...", "Rendering PDF..."]);
  try {
    await saveProfile();
    await renderLivePdfPreview(false);
    hideProgress("status");
    if (livePdfBlob) {
      showPdfPreview(livePdfBlob, getSmartPdfFilename());
    }
    setStatus("Preview ready.");
  } catch (err) {
    hideProgress("status");
    setStatus("Error: " + err.message, true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindHeader();
  loadProfile();

  document.getElementById("add-education").addEventListener("click", () => {
    profileData.education.push({ degree: "", org: "", location: "", dates: "", details: [] });
    renderEducation();
    queueLivePdfRender();
  });
  document.getElementById("add-experience").addEventListener("click", () => {
    profileData.experience.push({
      type: "job", org: "", role: "", location: "", dates: "", bullets: [],
    });
    renderExperience();
    queueLivePdfRender();
  });
  document.getElementById("add-project").addEventListener("click", () => {
    profileData.projects.push({
      title: "", tech: [], date: "", link: "", type: "personal", bullets: [],
    });
    renderProjects();
    queueLivePdfRender();
  });
  document.getElementById("add-skill").addEventListener("click", () => {
    profileData.skills.push({ category: "", items: [] });
    renderSkills();
    queueLivePdfRender();
  });
  document.getElementById("add-certification").addEventListener("click", () => {
    profileData.certifications.push({ title: "", org: "", date: "" });
    renderCertifications();
    queueLivePdfRender();
  });

  document.getElementById("save-profile").addEventListener("click", () => {
    saveProfileOnly();
  });

  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    saveAndDownload();
  });

  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("input", () => {
      queueLivePdfRender();
    });
    profileForm.addEventListener("change", () => {
      queueLivePdfRender();
    });
  }

  // Live preview dock buttons
  document.getElementById("live-pdf-refresh-btn")?.addEventListener("click", () => {
    renderLivePdfPreview(false);
  });

  document.getElementById("live-pdf-download-btn")?.addEventListener("click", () => {
    downloadCurrentMasterPdf();
  });

  document.getElementById("live-pdf-fullscreen-btn")?.addEventListener("click", () => {
    if (livePdfBlob) {
      showPdfPreview(livePdfBlob, getSmartPdfFilename());
    } else {
      renderLivePdfPreview(false).then(() => {
        if (livePdfBlob) showPdfPreview(livePdfBlob, getSmartPdfFilename());
      });
    }
  });
});
