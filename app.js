const fileInput = document.getElementById("file-input");
const preview = document.getElementById("preview");
const scanButton = document.getElementById("scan-button");
const statusEl = document.getElementById("status");
const partList = document.getElementById("part-list");
const emptyState = document.getElementById("empty-state");
const exportArea = document.getElementById("export");
const copyButton = document.getElementById("copy-button");
const clearButton = document.getElementById("clear-button");
const dropZone = document.getElementById("drop-zone");
const patternInput = document.getElementById("pattern");

let currentFile = null;
let partNumbers = new Set();
let pdfCanvas = null;

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.js";
}

const setStatus = (message) => {
  statusEl.textContent = message;
};

const updateList = () => {
  partList.innerHTML = "";
  const items = Array.from(partNumbers).sort();
  if (items.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      partList.appendChild(li);
    });
  }
  exportArea.value = items.join("\n");
};

const renderPdfPreview = async (file) => {
  if (!window.pdfjsLib) {
    preview.textContent = "PDF preview unavailable. PDF.js failed to load.";
    return null;
  }

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
};

const loadPreview = async (file) => {
  preview.innerHTML = "";
  if (!file) {
    preview.textContent = "No file loaded yet.";
    return;
  }

  if (file.type === "application/pdf") {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = "Rendering PDF preview...";
    preview.appendChild(placeholder);
    try {
      const canvas = await renderPdfPreview(file);
      if (canvas) {
        preview.innerHTML = "";
        preview.appendChild(canvas);
        pdfCanvas = canvas;
      }
    } catch (error) {
      console.error(error);
      preview.textContent = "Unable to render PDF preview.";
    }
    return;
  }

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.onload = () => URL.revokeObjectURL(img.src);
  preview.appendChild(img);
};

const extractPartNumbers = (text) => {
  let pattern;
  try {
    pattern = new RegExp(patternInput.value, "gi");
  } catch (error) {
    setStatus("Regex pattern error. Please correct the pattern.");
    return [];
  }

  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const value = match[1] || match[0];
    if (value) {
      matches.push(value.toUpperCase());
    }
  }
  return matches;
};

const handleFile = (file) => {
  currentFile = file;
  pdfCanvas = null;
  loadPreview(file);
  setStatus("Ready to scan.");
};

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) {
    fileInput.files = event.dataTransfer.files;
    handleFile(file);
  }
});

scanButton.addEventListener("click", async () => {
  if (!currentFile) {
    setStatus("Upload a drawing first.");
    return;
  }

  setStatus("Running OCR... this can take a minute for large drawings.");
  scanButton.disabled = true;

  try {
    let source = currentFile;
    if (currentFile.type === "application/pdf") {
      if (!pdfCanvas) {
        pdfCanvas = await renderPdfPreview(currentFile);
      }
      if (pdfCanvas) {
        source = pdfCanvas;
      }
    }

    const result = await Tesseract.recognize(source, "eng", {
      logger: (message) => {
        if (message.status && message.progress !== undefined) {
          setStatus(`${message.status} ${(message.progress * 100).toFixed(0)}%`);
        }
      },
    });

    const matches = extractPartNumbers(result.data.text || "");
    matches.forEach((item) => partNumbers.add(item));
    updateList();

    setStatus(
      matches.length
        ? `Scan complete. Found ${matches.length} matches.`
        : "Scan complete. No matches found; try adjusting the pattern."
    );
  } catch (error) {
    console.error(error);
    setStatus("OCR failed. Please try another file or refresh the page.");
  } finally {
    scanButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  if (!exportArea.value) {
    setStatus("No part numbers to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(exportArea.value);
    setStatus("Copied list to clipboard.");
  } catch (error) {
    setStatus("Copy failed. You can select the list manually.");
  }
});

clearButton.addEventListener("click", () => {
  partNumbers = new Set();
  updateList();
  setStatus("Cleared list.");
});

updateList();
