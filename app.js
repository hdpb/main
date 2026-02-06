const fileInputA = document.getElementById("file-input-a");
const fileInputB = document.getElementById("file-input-b");
const previewA = document.getElementById("preview-a");
const previewB = document.getElementById("preview-b");
const scanButtonA = document.getElementById("scan-button-a");
const scanButtonB = document.getElementById("scan-button-b");
const statusA = document.getElementById("status-a");
const statusB = document.getElementById("status-b");
const partListA = document.getElementById("part-list-a");
const partListB = document.getElementById("part-list-b");
const emptyStateA = document.getElementById("empty-state-a");
const emptyStateB = document.getElementById("empty-state-b");
const exportA = document.getElementById("export-a");
const exportB = document.getElementById("export-b");
const comparisonExport = document.getElementById("export");
const copyButton = document.getElementById("copy-button");
const clearButton = document.getElementById("clear-button");
const dropZoneA = document.getElementById("drop-zone-a");
const dropZoneB = document.getElementById("drop-zone-b");
const sharedList = document.getElementById("shared-list");
const onlyAList = document.getElementById("only-a-list");
const onlyBList = document.getElementById("only-b-list");
const emptyShared = document.getElementById("empty-shared");
const emptyOnlyA = document.getElementById("empty-only-a");
const emptyOnlyB = document.getElementById("empty-only-b");
const patternInput = document.getElementById("pattern");

let currentFileA = null;
let currentFileB = null;
let partNumbersA = new Set();
let partNumbersB = new Set();
let pdfCanvasA = null;
let pdfCanvasB = null;

const pdfJsSources = [
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js",
  "https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.min.js",
];

const pdfWorkerSources = [
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js",
  "https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.min.js",
];

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

const ensurePdfJsLoaded = async () => {
  if (window.pdfjsLib) {
    return true;
  }

  for (const src of pdfJsSources) {
    try {
      await loadScript(src);
      if (window.pdfjsLib) {
        break;
      }
    } catch (error) {
      console.warn(error);
    }
  }

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSources[0];
    return true;
  }

  return false;
};

const setStatus = (element, message) => {
  element.textContent = message;
};

const updateList = (listElement, emptyElement, exportElement, itemsSet) => {
  listElement.innerHTML = "";
  const items = Array.from(itemsSet).sort();
  if (items.length === 0) {
    emptyElement.style.display = "block";
  } else {
    emptyElement.style.display = "none";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      listElement.appendChild(li);
    });
  }
  exportElement.value = items.join("\n");
};

const updateComparison = () => {
  sharedList.innerHTML = "";
  onlyAList.innerHTML = "";
  onlyBList.innerHTML = "";

  const shared = [];
  const onlyA = [];
  const onlyB = [];

  partNumbersA.forEach((item) => {
    if (partNumbersB.has(item)) {
      shared.push(item);
    } else {
      onlyA.push(item);
    }
  });
  partNumbersB.forEach((item) => {
    if (!partNumbersA.has(item)) {
      onlyB.push(item);
    }
  });

  const render = (items, listEl, emptyEl) => {
    if (items.length === 0) {
      emptyEl.style.display = "block";
    } else {
      emptyEl.style.display = "none";
      items.sort().forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        listEl.appendChild(li);
      });
    }
  };

  render(shared, sharedList, emptyShared);
  render(onlyA, onlyAList, emptyOnlyA);
  render(onlyB, onlyBList, emptyOnlyB);

  const lines = [
    "Shared parts:",
    ...shared.sort().map((item) => `  - ${item}`),
    "",
    "Only in A:",
    ...onlyA.sort().map((item) => `  - ${item}`),
    "",
    "Only in B:",
    ...onlyB.sort().map((item) => `  - ${item}`),
  ];
  comparisonExport.value = lines.join("\n").trim();
};

const isPdfFile = (file) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const renderPdfPreview = async (file, previewElement) => {
  const pdfReady = await ensurePdfJsLoaded();
  if (!pdfReady || !window.pdfjsLib) {
    previewElement.textContent = "PDF preview unavailable. PDF.js failed to load.";
    return null;
  }

  const data = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch (error) {
    if (pdfjsLib?.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSources[1];
    }
    pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  }
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
};

const loadPreview = async (file, previewElement, statusElement) => {
  previewElement.innerHTML = "";
  if (!file) {
    previewElement.textContent = "No file loaded yet.";
    return;
  }

  if (isPdfFile(file)) {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = "Rendering PDF preview...";
    previewElement.appendChild(placeholder);
    try {
      const canvas = await renderPdfPreview(file, previewElement);
      if (canvas) {
        previewElement.innerHTML = "";
        previewElement.appendChild(canvas);
        return canvas;
      }
    } catch (error) {
      console.error(error);
      previewElement.textContent = "Unable to render PDF preview.";
      setStatus(
        statusElement,
        "PDF preview failed. If you opened this via file://, use a local server."
      );
    }
    return;
  }

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.onload = () => URL.revokeObjectURL(img.src);
  previewElement.appendChild(img);
  return null;
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

const handleFile = async (file, slot) => {
  if (slot === "A") {
    currentFileA = file;
    pdfCanvasA = await loadPreview(file, previewA, statusA);
    setStatus(statusA, "Ready to scan drawing A.");
  } else {
    currentFileB = file;
    pdfCanvasB = await loadPreview(file, previewB, statusB);
    setStatus(statusB, "Ready to scan drawing B.");
  }
};

fileInputA.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    handleFile(file, "A");
  }
});

fileInputB.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    handleFile(file, "B");
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZoneA.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZoneA.classList.add("dragover");
  });
  dropZoneB.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZoneB.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZoneA.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZoneA.classList.remove("dragover");
  });
  dropZoneB.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZoneB.classList.remove("dragover");
  });
});

dropZoneA.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) {
    fileInputA.files = event.dataTransfer.files;
    handleFile(file, "A");
  }
});

dropZoneB.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) {
    fileInputB.files = event.dataTransfer.files;
    handleFile(file, "B");
  }
});

const runScan = async (slot) => {
  const isA = slot === "A";
  const currentFile = isA ? currentFileA : currentFileB;
  const statusElement = isA ? statusA : statusB;
  const scanButton = isA ? scanButtonA : scanButtonB;
  const previewElement = isA ? previewA : previewB;
  const listElement = isA ? partListA : partListB;
  const emptyElement = isA ? emptyStateA : emptyStateB;
  const exportElement = isA ? exportA : exportB;

  if (!currentFile) {
    setStatus(statusElement, "Upload a drawing first.");
    return;
  }

  setStatus(statusElement, "Running OCR... this can take a minute for large drawings.");
  scanButton.disabled = true;

  try {
    let source = currentFile;
    if (isPdfFile(currentFile)) {
      let pdfCanvas = isA ? pdfCanvasA : pdfCanvasB;
      if (!pdfCanvas) {
        pdfCanvas = await loadPreview(currentFile, previewElement, statusElement);
        if (isA) {
          pdfCanvasA = pdfCanvas;
        } else {
          pdfCanvasB = pdfCanvas;
        }
      }
      if (pdfCanvas) {
        source = pdfCanvas;
      }
    }

    const result = await Tesseract.recognize(source, "eng", {
      logger: (message) => {
        if (message.status && message.progress !== undefined) {
          setStatus(
            statusElement,
            `${message.status} ${(message.progress * 100).toFixed(0)}%`
          );
        }
      },
    });

    const matches = extractPartNumbers(result.data.text || "");
    const setToUpdate = isA ? partNumbersA : partNumbersB;
    matches.forEach((item) => setToUpdate.add(item));
    updateList(listElement, emptyElement, exportElement, setToUpdate);
    updateComparison();

    setStatus(
      statusElement,
      matches.length
        ? `Scan complete. Found ${matches.length} matches.`
        : "Scan complete. No matches found; try adjusting the pattern."
    );
  } catch (error) {
    console.error(error);
    setStatus(statusElement, "OCR failed. Please try another file or refresh the page.");
  } finally {
    scanButton.disabled = false;
  }
};

scanButtonA.addEventListener("click", () => runScan("A"));
scanButtonB.addEventListener("click", () => runScan("B"));

copyButton.addEventListener("click", async () => {
  if (!comparisonExport.value) {
    setStatus(statusA, "No comparison to copy.");
    setStatus(statusB, "No comparison to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(comparisonExport.value);
    setStatus(statusA, "Copied comparison to clipboard.");
    setStatus(statusB, "Copied comparison to clipboard.");
  } catch (error) {
    setStatus(statusA, "Copy failed. You can select the list manually.");
    setStatus(statusB, "Copy failed. You can select the list manually.");
  }
});

clearButton.addEventListener("click", () => {
  partNumbersA = new Set();
  partNumbersB = new Set();
  currentFileA = null;
  currentFileB = null;
  pdfCanvasA = null;
  pdfCanvasB = null;
  previewA.innerHTML = "<p>No file loaded yet.</p>";
  previewB.innerHTML = "<p>No file loaded yet.</p>";
  updateList(partListA, emptyStateA, exportA, partNumbersA);
  updateList(partListB, emptyStateB, exportB, partNumbersB);
  updateComparison();
  setStatus(statusA, "Cleared list A.");
  setStatus(statusB, "Cleared list B.");
});

updateList(partListA, emptyStateA, exportA, partNumbersA);
updateList(partListB, emptyStateB, exportB, partNumbersB);
updateComparison();
