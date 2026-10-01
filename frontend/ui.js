// Shared UI helpers used by both the Profile page and the JD page:
// an inline PDF preview modal, and an indeterminate progress indicator
// with rotating status text (no fake percentage -- a single LLM/compile
// request has no real sub-progress to report).

function showPdfPreview(blob, filename) {
  const overlay = document.getElementById("pdf-modal-overlay");
  const iframe = document.getElementById("pdf-modal-iframe");
  const downloadBtn = document.getElementById("pdf-modal-download");

  const url = URL.createObjectURL(blob);
  iframe.src = url;
  overlay.dataset.blobUrl = url;

  downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  overlay.style.display = "flex";
}

function closePdfPreview() {
  const overlay = document.getElementById("pdf-modal-overlay");
  const iframe = document.getElementById("pdf-modal-iframe");
  overlay.style.display = "none";
  iframe.src = "";
  if (overlay.dataset.blobUrl) {
    URL.revokeObjectURL(overlay.dataset.blobUrl);
    delete overlay.dataset.blobUrl;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("pdf-modal-close");
  const overlay = document.getElementById("pdf-modal-overlay");
  if (closeBtn) closeBtn.addEventListener("click", closePdfPreview);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePdfPreview();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && overlay.style.display === "flex") closePdfPreview();
  });
});

const _progressIntervals = {};

function showProgress(containerId, messages) {
  const container = document.getElementById(containerId);
  container.classList.remove("error", "success");
  container.innerHTML =
    '<div class="progress-wrap">' +
    '<div class="progress-track"><div class="progress-fill"></div></div>' +
    `<div class="progress-label" id="${containerId}-label">${messages[0]}</div>` +
    "</div>";

  let i = 0;
  _progressIntervals[containerId] = setInterval(() => {
    i = (i + 1) % messages.length;
    const label = document.getElementById(`${containerId}-label`);
    if (label) label.textContent = messages[i];
  }, 2200);
}

function hideProgress(containerId) {
  if (_progressIntervals[containerId]) {
    clearInterval(_progressIntervals[containerId]);
    delete _progressIntervals[containerId];
  }
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = "";
}

// ============================================================= Fluid Expanded Editor
let _activeTargetElement = null;
let _editorBackdrop = null;
let _editorTextarea = null;
let _editorTitle = null;
let _editorStats = null;
let _editorScopeToggle = null;
let _suppressAutoOpenUntil = 0;

function isAutoExpandAllEnabled() {
  const saved = localStorage.getItem("smartjobai_expand_all_boxes");
  // Default to true as requested
  return saved === null ? true : saved === "true";
}

function setAutoExpandAllEnabled(val) {
  localStorage.setItem("smartjobai_expand_all_boxes", val ? "true" : "false");
}

function createExpandedEditorDom() {
  if (_editorBackdrop) return;

  _editorBackdrop = document.createElement("div");
  _editorBackdrop.className = "expanded-editor-backdrop";
  _editorBackdrop.id = "expanded-editor-modal";
  _editorBackdrop.innerHTML = `
    <div class="expanded-editor-panel" role="dialog" aria-modal="true">
      <div class="expanded-editor-header">
        <div class="expanded-editor-title">
          <span class="dot"></span>
          <span id="expanded-editor-title-text">Expanded Editor</span>
        </div>
        <div class="expanded-editor-meta">
          <span class="expanded-editor-stats" id="expanded-editor-stats-text">0 words · 0 chars</span>
          <button type="button" class="modal-close" id="expanded-editor-close-btn" title="Close (Esc)">&times;</button>
        </div>
      </div>
      <div class="expanded-editor-body">
        <textarea class="expanded-editor-textarea" id="expanded-editor-input" placeholder="Type or paste your text here..."></textarea>
      </div>
      <div class="expanded-editor-footer">
        <div class="expanded-editor-hint">
          <span>Press <kbd>Esc</kbd> or click <b>Done</b> to return</span>
          <label style="display: inline-flex; align-items: center; gap: 6px; margin-left: 14px; font-size: 9.5px; color: var(--muted); cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em;">
            <input type="checkbox" id="expanded-editor-scope-toggle" style="accent-color: var(--vermilion); cursor: pointer;" />
            <span>Auto-expand all text boxes</span>
          </label>
        </div>
        <div class="expanded-editor-actions">
          <button type="button" class="secondary" id="expanded-editor-inline-btn" style="padding: 8px 16px; font-size: 10px; letter-spacing: 0.16em;">Edit Inline</button>
          <button type="button" class="primary" id="expanded-editor-done-btn" style="padding: 10px 24px; font-size: 10.5px;">Done</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(_editorBackdrop);

  _editorTextarea = document.getElementById("expanded-editor-input");
  _editorTitle = document.getElementById("expanded-editor-title-text");
  _editorStats = document.getElementById("expanded-editor-stats-text");
  _editorScopeToggle = document.getElementById("expanded-editor-scope-toggle");

  if (_editorScopeToggle) {
    _editorScopeToggle.checked = isAutoExpandAllEnabled();
    _editorScopeToggle.addEventListener("change", (e) => {
      setAutoExpandAllEnabled(e.target.checked);
    });
  }

  // Sync edits back live to target element
  _editorTextarea.addEventListener("input", () => {
    if (_activeTargetElement) {
      _activeTargetElement.value = _editorTextarea.value;
      _activeTargetElement.dispatchEvent(new Event("input", { bubbles: true }));
      _activeTargetElement.dispatchEvent(new Event("change", { bubbles: true }));
    }
    updateEditorStats(_editorTextarea.value);
  });

  // Close handlers
  const closeBtn = document.getElementById("expanded-editor-close-btn");
  const doneBtn = document.getElementById("expanded-editor-done-btn");
  const inlineBtn = document.getElementById("expanded-editor-inline-btn");

  if (closeBtn) closeBtn.addEventListener("click", closeExpandedEditor);
  if (doneBtn) doneBtn.addEventListener("click", closeExpandedEditor);
  if (inlineBtn) {
    inlineBtn.addEventListener("click", () => {
      _suppressAutoOpenUntil = Date.now() + 60000; // 1 min inline typing mode
      closeExpandedEditor();
      if (_activeTargetElement) _activeTargetElement.focus();
    });
  }

  _editorBackdrop.addEventListener("click", (e) => {
    if (e.target === _editorBackdrop) closeExpandedEditor();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _editorBackdrop && _editorBackdrop.classList.contains("is-active")) {
      closeExpandedEditor();
    }
  });
}

function updateEditorStats(text) {
  if (!_editorStats) return;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  _editorStats.textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${chars} chars`;
}

function openExpandedEditor(targetElement, titleText) {
  createExpandedEditorDom();
  _activeTargetElement = targetElement;

  const title = titleText || findLabelForElement(targetElement);
  _editorTitle.textContent = title;
  _editorTextarea.value = targetElement.value || "";
  _editorTextarea.placeholder = targetElement.placeholder || "Type or paste your text here...";

  // If single line input, adjust min-height slightly for clean proportion
  if (targetElement.tagName === "INPUT") {
    _editorTextarea.style.minHeight = "240px";
  } else {
    _editorTextarea.style.minHeight = "380px";
  }

  updateEditorStats(_editorTextarea.value);

  // Animate in
  _editorBackdrop.classList.add("is-active");

  setTimeout(() => {
    _editorTextarea.focus();
    const len = _editorTextarea.value.length;
    _editorTextarea.setSelectionRange(len, len);
  }, 100);
}

function closeExpandedEditor() {
  if (!_editorBackdrop) return;
  _editorBackdrop.classList.remove("is-active");

  if (_activeTargetElement) {
    const el = _activeTargetElement;
    el.classList.add("editor-synced-pulse");
    setTimeout(() => el.classList.remove("editor-synced-pulse"), 1000);
  }
}

function findLabelForElement(el) {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${el.id}"]`);
    if (lbl) return lbl.textContent.trim() + " · Focus Mode";
  }

  const prev = el.previousElementSibling;
  if (prev && prev.tagName === "LABEL") {
    return prev.textContent.trim() + " · Focus Mode";
  }

  const parentLabel = el.closest("label");
  if (parentLabel) {
    return parentLabel.textContent.trim() + " · Focus Mode";
  }

  const bulletRow = el.closest(".bullet-row");
  if (bulletRow) {
    const entry = el.closest(".entry");
    if (entry) {
      const inputs = entry.querySelectorAll('input[type="text"]');
      const parts = [];
      inputs.forEach(inp => {
        if (inp.value && parts.length < 2 && inp !== el) {
          parts.push(inp.value.trim());
        }
      });
      if (parts.length > 0) {
        return parts.join(" · ") + (el.tagName === "TEXTAREA" ? " · Bullet Point" : " · Keywords");
      }
    }
    const section = el.closest("#experience-list") ? "Experience" : (el.closest("#project-list") ? "Project" : "Background");
    return `${section} · ${el.tagName === "TEXTAREA" ? "Bullet Accomplishment" : "Skill Keywords"}`;
  }

  if (el.placeholder) {
    return el.placeholder.replace(/\.\.\./g, "") + " · Focus Mode";
  }

  return "Expanded Editor";
}

function attachExpandableToElement(el) {
  if (el.dataset.hasExpandableAttached) return;
  // Ignore buttons, radios, checkboxes, file inputs, hidden inputs
  if (el.type === "button" || el.type === "submit" || el.type === "checkbox" || el.type === "radio" || el.type === "hidden") return;

  el.dataset.hasExpandableAttached = "true";

  // Wrap in container with expand pill if not already wrapped
  if (!el.parentElement.classList.contains("textarea-expand-wrap")) {
    const wrapper = document.createElement("div");
    wrapper.className = "textarea-expand-wrap" + (el.tagName === "INPUT" ? " is-input-wrap" : "");
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "textarea-expand-pill";
    pill.title = "Open expanded focus view";
    pill.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"></polyline>
        <polyline points="9 21 3 21 3 15"></polyline>
        <line x1="21" y1="3" x2="14" y2="10"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
      <span>Expand</span>
    `;
    wrapper.appendChild(pill);

    pill.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openExpandedEditor(el, findLabelForElement(el));
    });
  }

  // Click on text box triggers fluid expand
  el.addEventListener("click", (e) => {
    if (Date.now() < _suppressAutoOpenUntil) return;
    if (el.tagName === "TEXTAREA" || isAutoExpandAllEnabled()) {
      openExpandedEditor(el, findLabelForElement(el));
    }
  });

  // Double click always opens
  el.addEventListener("dblclick", () => {
    openExpandedEditor(el, findLabelForElement(el));
  });
}

function scanAndAttachExpandables() {
  createExpandedEditorDom();
  // Target all textareas and text/email/search inputs across static and dynamic sections
  const targets = document.querySelectorAll("textarea, input[type='text'], input[type='email'], input:not([type])");
  targets.forEach(attachExpandableToElement);
}

function initExpandableTextareas() {
  scanAndAttachExpandables();

  // Continually observe dynamic additions (e.g. newly loaded bullets, new experiences, new projects)
  if (window.MutationObserver && !window._expandableObserverAttached) {
    window._expandableObserverAttached = true;
    const observer = new MutationObserver(() => {
      scanAndAttachExpandables();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initExpandableTextareas);
} else {
  initExpandableTextareas();
}

