let profileData = {
  name: "", phone: "", email: "", linkedin: "", github: "", location: "", summary: "",
  education: [], experience: [], projects: [], skills: [], certifications: [],
};

const HEADER_FIELDS = ["name", "phone", "email", "linkedin", "github", "location", "summary"];

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

function labeledInput(labelText, value, onInput, type = "text") {
  const wrap = el("div");
  wrap.appendChild(el("label", {}, [document.createTextNode(labelText)]));
  const input = el("input", { type });
  input.value = value || "";
  input.addEventListener("input", (e) => onInput(e.target.value));
  wrap.appendChild(input);
  return wrap;
}

function labeledTextarea(labelText, value, onInput) {
  const wrap = el("div");
  wrap.appendChild(el("label", {}, [document.createTextNode(labelText)]));
  const ta = el("textarea");
  ta.value = value || "";
  ta.addEventListener("input", (e) => onInput(e.target.value));
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
  select.addEventListener("change", (e) => onInput(e.target.value));
  wrap.appendChild(select);
  return wrap;
}

function bulletsEditor(bullets, onChange) {
  const container = el("div");

  function render() {
    container.innerHTML = "";
    bullets.forEach((b, i) => {
      const row = el("div", { class: "bullet-row" });
      const textArea = el("textarea", { placeholder: "Bullet text" });
      textArea.value = b.text || "";
      textArea.addEventListener("input", (e) => { b.text = e.target.value; });

      const kwInput = el("input", { type: "text", placeholder: "keywords, comma, separated" });
      kwInput.value = (b.keywords || []).join(", ");
      kwInput.addEventListener("input", (e) => { b.keywords = csvToList(e.target.value); });

      const removeBtn = el("button", { class: "remove", type: "button" });
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        bullets.splice(i, 1);
        render();
        onChange();
      });

      row.appendChild(textArea);
      row.appendChild(kwInput);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });

    const addBtn = el("button", { class: "add", type: "button" });
    addBtn.textContent = "+ Add bullet";
    addBtn.addEventListener("click", () => {
      bullets.push({ text: "", keywords: [] });
      render();
      onChange();
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
    if (input) input.addEventListener("input", (e) => { profileData[field] = e.target.value; });
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
    const removeBtn = el("button", { class: "remove", type: "button" });
    removeBtn.textContent = "Remove education entry";
    removeBtn.addEventListener("click", () => {
      profileData.education.splice(i, 1);
      renderEducation();
    });
    entry.appendChild(removeBtn);
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
    const removeBtn = el("button", { class: "remove", type: "button" });
    removeBtn.textContent = "Remove experience entry";
    removeBtn.addEventListener("click", () => {
      profileData.experience.splice(i, 1);
      renderExperience();
    });
    entry.appendChild(removeBtn);
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
    const removeBtn = el("button", { class: "remove", type: "button" });
    removeBtn.textContent = "Remove project";
    removeBtn.addEventListener("click", () => {
      profileData.projects.splice(i, 1);
      renderProjects();
    });
    entry.appendChild(removeBtn);
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
    const removeBtn = el("button", { class: "remove", type: "button" });
    removeBtn.textContent = "Remove skill category";
    removeBtn.addEventListener("click", () => {
      profileData.skills.splice(i, 1);
      renderSkills();
    });
    entry.appendChild(removeBtn);
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
    const removeBtn = el("button", { class: "remove", type: "button" });
    removeBtn.textContent = "Remove certification";
    removeBtn.addEventListener("click", () => {
      profileData.certifications.splice(i, 1);
      renderCertifications();
    });
    entry.appendChild(removeBtn);
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
    const resp = await fetch("/api/resume/render", { method: "POST" });
    if (!resp.ok) throw new Error(await resp.text());
    const blob = await resp.blob();
    hideProgress("status");
    showPdfPreview(blob, "resume.pdf");
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
  });
  document.getElementById("add-experience").addEventListener("click", () => {
    profileData.experience.push({
      type: "job", org: "", role: "", location: "", dates: "", bullets: [],
    });
    renderExperience();
  });
  document.getElementById("add-project").addEventListener("click", () => {
    profileData.projects.push({
      title: "", tech: [], date: "", link: "", type: "personal", bullets: [],
    });
    renderProjects();
  });
  document.getElementById("add-skill").addEventListener("click", () => {
    profileData.skills.push({ category: "", items: [] });
    renderSkills();
  });
  document.getElementById("add-certification").addEventListener("click", () => {
    profileData.certifications.push({ title: "", org: "", date: "" });
    renderCertifications();
  });

  document.getElementById("save-profile").addEventListener("click", () => {
    saveProfileOnly();
  });

  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    saveAndDownload();
  });
});
