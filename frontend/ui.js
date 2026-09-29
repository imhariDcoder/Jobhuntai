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
