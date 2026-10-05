const PROVIDER_STORAGE_KEY = "smartjobai_provider";
const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini" };

let lastResult = null; // { matched_keywords, missing_keywords, match_score, diffs, selected_bullets, honesty_note, profile_skills }
let selectedMissingKeywords = new Set();
let masterProfileSkills = [];
let tailoredSkills = [];

/* ============================================================= Client-side Domain Categorization Engine */
const CLIENT_SKILL_DOMAINS = [
  {
    domain: "Languages",
    defaultCategory: "Programming & Query Languages",
    keywords: ["language", "programming", "query", "coding", "scripting"],
    exact: new Set([
      "python", "sql", "r", "java", "c", "c++", "c#", "typescript", "javascript",
      "js", "ts", "go", "golang", "rust", "php", "ruby", "bash", "shell",
      "powershell", "scala", "kotlin", "swift", "perl", "dart", "lua", "julia",
      "html", "css", "sass", "scss", "graphql", "sparql", "cypher", "vba"
    ]),
    regex: /\b(python|sql|java|typescript|javascript|golang|rust|bash|scala|c\+\+|c#|kotlin|swift|ruby|php|html5?|css3?)\b|query\s+language|programming\s+language/i
  },
  {
    domain: "BI & Visualization",
    defaultCategory: "BI & Visualization",
    keywords: ["visual", "bi", "report", "dashboard", "intelligence", "tableau", "power bi"],
    exact: new Set([
      "power bi", "powerbi", "tableau", "looker", "looker studio", "qlik", "qlikview",
      "qlik sense", "excel", "advanced excel", "excel (advanced)", "dax", "power query",
      "matplotlib", "seaborn", "plotly", "d3.js", "dash", "streamlit", "superset",
      "metabase", "microstrategy", "ssrs", "ssis", "ssas", "reporting",
      "data visualization", "interactive dashboards", "executive bi dashboards",
      "executive dashboards", "kpi dashboards", "business intelligence"
    ]),
    regex: /dashboard|visualization|visuals|power\s*bi|tableau|looker|power\s*query|\bdax\b|reporting|business\s+intelligence|kpi/i
  },
  {
    domain: "Data & Databases",
    defaultCategory: "Data & Databases",
    keywords: ["data", "database", "storage", "warehouse", "pipeline", "etl", "db"],
    exact: new Set([
      "pandas", "numpy", "scipy", "postgresql", "postgres", "mysql", "sqlite",
      "mongodb", "redis", "cassandra", "dynamodb", "oracle", "snowflake",
      "bigquery", "redshift", "databricks", "spark", "pyspark", "hadoop", "hive",
      "kafka", "airflow", "dbt", "etl", "elt", "data modeling", "data warehouse",
      "data warehousing", "data lake", "data pipelines", "data extraction",
      "data manipulation", "manipulation", "data wrangling", "data mining",
      "data cleansing", "data cleaning", "data validation", "data ingestion",
      "relational databases", "nosql", "oltp", "olap",
      "transactional and customer behavior datasets", "customer behavior datasets",
      "transactional datasets", "sql queries"
    ]),
    regex: /data\s+(extraction|manipulation|wrangling|cleansing|cleaning|modeling|pipeline|warehouse|lake|ingestion|storage|mining)|dataset|database|postgres|mysql|mongodb|redis|snowflake|bigquery|\b(spark|pyspark|airflow|dbt|pandas|numpy|scipy|etl|elt|nosql|olap|oltp)\b|sql\s+queries|relational\s+data/i
  },
  {
    domain: "Machine Learning & AI",
    defaultCategory: "Machine Learning & AI",
    keywords: ["machine learning", "ml", "ai", "artificial intelligence", "data science", "deep learning", "neural"],
    exact: new Set([
      "scikit-learn", "sklearn", "tensorflow", "pytorch", "keras", "opencv",
      "cnn", "cnns", "rnn", "lstm", "transformer", "transformers", "llm", "llms",
      "nlp", "natural language processing", "nltk", "spacy", "huggingface",
      "genai", "generative ai", "langchain", "llamaindex", "vector database",
      "chromadb", "pinecone", "faiss", "machine learning", "deep learning",
      "supervised learning", "unsupervised learning", "computer vision",
      "predictive modeling", "reinforcement learning"
    ]),
    regex: /machine\s+learning|deep\s+learning|neural\s+net|scikit|tensorflow|pytorch|\b(nlp|cnn|cnns|rnn|lstm|llm|llms|genai|langchain)\b|predictive\s+model|computer\s+vision|generative\s+ai/i
  },
  {
    domain: "Testing & QA",
    defaultCategory: "Testing & Automation",
    keywords: ["test", "testing", "qa", "automation", "quality"],
    exact: new Set([
      "selenium", "cypress", "playwright", "puppeteer", "pytest", "junit",
      "testng", "jest", "mocha", "cucumber", "test automation", "unit testing",
      "integration testing", "e2e testing", "qa", "quality assurance",
      "automated testing", "load testing", "jmeter", "postman testing"
    ]),
    regex: /test\s+automation|unit\s+test|automated\s+test|selenium|cypress|playwright|pytest|quality\s+assurance|\b(qa|e2e|junit)\b/i
  },
  {
    domain: "Cloud & DevOps",
    defaultCategory: "Cloud & DevOps",
    keywords: ["cloud", "devops", "infra", "infrastructure", "platform", "deployment", "ci/cd", "container"],
    exact: new Set([
      "aws", "amazon web services", "azure", "microsoft azure", "gcp",
      "google cloud", "google cloud platform", "docker", "kubernetes", "k8s",
      "terraform", "ansible", "jenkins", "github actions", "gitlab ci", "ci/cd",
      "linux", "unix", "ubuntu", "nginx", "apache", "serverless", "lambda",
      "cloudformation", "helm", "openshift"
    ]),
    regex: /\b(aws|azure|gcp|docker|kubernetes|k8s|terraform|ansible|jenkins|ci\/cd|linux|unix|ubuntu|nginx|serverless|lambda|helm|openshift)\b|cloud|devops|infrastructure|container/i
  },
  {
    domain: "Developer Tools",
    defaultCategory: "Tools",
    keywords: ["tool", "tools", "platform", "developer tools", "utilities", "ide"],
    exact: new Set([
      "git", "github", "gitlab", "bitbucket", "jira", "confluence", "trello",
      "asana", "postman", "swagger", "insomnia", "vs code", "visual studio",
      "pycharm", "intellij", "eclipse", "docker desktop", "terminal"
    ]),
    regex: /\b(git|github|gitlab|bitbucket|jira|confluence|postman|swagger|vs\s*code|pycharm|intellij)\b|developer\s+tools/i
  },
  {
    domain: "Concepts & Methodologies",
    defaultCategory: "Concepts",
    keywords: ["concept", "concepts", "methodolog", "practice", "management", "leadership", "competenc", "analytical"],
    exact: new Set([
      "agile", "scrum", "kanban", "sprint planning", "sdlc", "waterfall",
      "exploratory data analysis", "exploratory data analysis (eda)", "eda",
      "statistical analysis", "statistics", "hypothesis testing", "a/b testing",
      "experimentation", "root cause analysis", "performance optimization",
      "optimization", "object-oriented programming", "oop", "design patterns",
      "solid principles", "rest apis", "rest", "restful", "system design",
      "stakeholder management", "cross-functional stakeholders",
      "cross-functional collaboration", "cross-functional leadership",
      "senior leadership", "leadership", "mentorship", "requirement gathering",
      "business analysis", "data governance", "compliance", "data-driven insights",
      "problem solving", "senior data analyst", "business intelligence specialist"
    ]),
    regex: /agile|scrum|kanban|stakeholder|leadership|exploratory\s+data\s+analysis|\b(eda|oop|sdlc)\b|statistical|optimization|data-driven|management|specialist|analyst/i
  }
];

function isGenericCategory(name) {
  const n = (name || "").toLowerCase();
  return ["additional", "self-reported", "targeted jd", "other skills", "misc"].some(junk => n.includes(junk));
}

function classifySkillClient(skill, existingCategories = []) {
  const sClean = (skill || "").trim().toLowerCase();
  if (!sClean) return "Tools";

  const cleanExisting = existingCategories.filter(c => !isGenericCategory(c));

  let matchedDomain = null;
  for (const dom of CLIENT_SKILL_DOMAINS) {
    if (dom.exact.has(sClean) || dom.regex.test(sClean)) {
      matchedDomain = dom;
      break;
    }
  }

  if (matchedDomain) {
    for (const cat of cleanExisting) {
      const cLow = cat.toLowerCase();
      if (matchedDomain.keywords.some(kw => cLow.includes(kw))) {
        return cat;
      }
    }
    return matchedDomain.defaultCategory;
  }

  for (const cat of cleanExisting) {
    const cLow = cat.toLowerCase();
    const words = sClean.split(/\s+/).filter(w => w.length > 3);
    if (words.some(w => cLow.includes(w))) {
      return cat;
    }
  }

  if (/management|analysis|strategy|leadership|design|process/i.test(sClean)) {
    const conceptCat = cleanExisting.find(c => /concept|methodolog|competenc/i.test(c));
    return conceptCat || "Concepts";
  }

  const toolCat = cleanExisting.find(c => /tool/i.test(c));
  return toolCat || "Tools";
}

async function categorizeSkillsBatch(skills, existingCategories = []) {
  try {
    const resp = await fetch("/api/skills/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills, existing_categories: existingCategories })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.assignments) return data.assignments;
    }
  } catch (e) {
    // Fallback to client classifier
  }
  const fallback = {};
  for (const s of skills) {
    fallback[s] = classifySkillClient(s, existingCategories);
  }
  return fallback;
}


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

  const newCatOpt = document.createElement("option");
  newCatOpt.value = "__NEW__";
  newCatOpt.textContent = "+ Create New Category...";
  categorySelect.appendChild(newCatOpt);

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
  setStatus("add-keywords-status", "Matching skills to specific categories...");

  try {
    const toAdd = Array.from(selectedMissingKeywords);
    if (!toAdd.length) return;

    const currentCatNames = tailoredSkills.map(s => s.category);
    const assignments = await categorizeSkillsBatch(toAdd, currentCatNames);

    // Group additions by their specific target category
    const addedSummary = {}; // catName -> [skills]

    for (const kw of toAdd) {
      const targetCatName = assignments[kw] || classifySkillClient(kw, currentCatNames);
      let targetCat = tailoredSkills.find(s => s.category.toLowerCase() === targetCatName.toLowerCase());
      if (!targetCat) {
        targetCat = { category: targetCatName, items: [] };
        tailoredSkills.push(targetCat);
      }
      const existingLower = new Set(targetCat.items.map(i => i.toLowerCase()));
      if (!existingLower.has(kw.toLowerCase())) {
        targetCat.items.push(kw);
      }
      if (!addedSummary[targetCat.category]) addedSummary[targetCat.category] = [];
      addedSummary[targetCat.category].push(kw);
    }

    renderTailoredSkills();

    // Also persist to master profile
    const resp = await fetch("/api/profile");
    if (resp.ok) {
      const profile = await resp.json();
      if (!profile.skills) profile.skills = [];

      for (const [catName, items] of Object.entries(addedSummary)) {
        let profCat = profile.skills.find(s => s.category.toLowerCase() === catName.toLowerCase());
        if (!profCat) {
          profCat = { category: catName, items: [] };
          profile.skills.push(profCat);
        }
        const profLower = new Set(profCat.items.map(i => i.toLowerCase()));
        for (const item of items) {
          if (!profLower.has(item.toLowerCase())) {
            profCat.items.push(item);
          }
        }
      }

      const putResp = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (putResp.ok) {
        const updatedProfile = await putResp.json();
        masterProfileSkills = JSON.parse(JSON.stringify(updatedProfile.skills));
      }
    }

    lastResult.missing_keywords = lastResult.missing_keywords.filter((k) => !toAdd.includes(k));
    lastResult.matched_keywords = [...lastResult.matched_keywords, ...toAdd];
    selectedMissingKeywords.clear();

    renderChips();
    updateScoreDisplay();

    const summaryParts = Object.entries(addedSummary).map(([cat, items]) => `${cat} (${items.length})`);
    setStatus(
      "add-keywords-status",
      `Added ${toAdd.length} skill${toAdd.length > 1 ? "s" : ""} to specific categories: ${summaryParts.join(", ")}.`
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
      let cat = newSkillCatSelect.value;
      if (!val) return;
      if (cat === "__NEW__") {
        const customCat = prompt("Enter new skill category name (e.g. Cloud & Infrastructure, Mobile Development):");
        if (!customCat || !customCat.trim()) return;
        cat = customCat.trim();
      }
      addSkillToTailored(cat, val);
      newSkillInput.value = "";
    };
    addCustomSkillBtn.addEventListener("click", handleAdd);
    newSkillInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    });
    newSkillInput.addEventListener("input", () => {
      const val = newSkillInput.value.trim();
      if (val.length >= 2 && newSkillCatSelect.value !== "__NEW__") {
        const predicted = classifySkillClient(val, tailoredSkills.map(s => s.category));
        const matchingOpt = Array.from(newSkillCatSelect.options).find(o => o.value.toLowerCase() === predicted.toLowerCase());
        if (matchingOpt) {
          newSkillCatSelect.value = matchingOpt.value;
        }
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
