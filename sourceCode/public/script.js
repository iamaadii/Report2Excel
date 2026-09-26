const API_URL = "http://localhost:5000";

let invoiceRows = [];
let invoiceType = "handwritten";
let selectedMode = "auto";

/* =========================
   DOM ELEMENTS
========================= */

const reportFileInput = document.getElementById("reportFileInput");
const reportChooseBtn = document.getElementById("reportChooseBtn");
const reportFileName = document.getElementById("reportFileName");
const reportRemoveBtn = document.getElementById("reportRemoveBtn");
const processUploadBtn = document.getElementById("processUploadBtn");
const uploadStatus = document.getElementById("uploadStatus");

const previewSection = document.getElementById("previewSection");
const detectedBadge = document.getElementById("detectedBadge");
const previewSubtitle = document.getElementById("previewSubtitle");
const invoiceTable = document.getElementById("invoiceTable");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const downloadBtn = document.getElementById("downloadBtn");
const addRowBtn = document.getElementById("addRowBtn");

const modePills = document.querySelectorAll(".mode-pill");

const workflowSteps = Array.from(
    document.querySelectorAll(".workflow-step[data-step]")
);

/* =========================
   MODE SELECTION
========================= */

modePills.forEach((pill) => {
    pill.addEventListener("click", () => {
        modePills.forEach((p) => {
            p.classList.remove("active");
            p.setAttribute("aria-checked", "false");
        });
        pill.classList.add("active");
        pill.setAttribute("aria-checked", "true");
        selectedMode = pill.getAttribute("data-mode") || "fast_handwritten";
    });
});

/* =========================
   WORKFLOW STEPS
========================= */

function setWorkflowStep(stepName) {
    const stepOrder = ["upload", "review", "export"];
    const targetIndex = stepOrder.indexOf(stepName);

    if (targetIndex === -1) return;

    workflowSteps.forEach((step) => {
        const stepKey = step.dataset.step;
        const currentIndex = stepOrder.indexOf(stepKey);

        step.classList.remove("active", "completed");

        if (currentIndex < targetIndex) {
            step.classList.add("completed");
        } else if (currentIndex === targetIndex) {
            step.classList.add("active");
        }
    });
}

/* =========================
   FILE SELECTION & DRAG-AND-DROP
========================= */

function handleFileChosen(file) {
    if (!file) return;

    reportFileName.textContent = file.name;
    reportRemoveBtn.classList.remove("hidden");
    processUploadBtn.disabled = false;
    uploadStatus.className = "status";
    uploadStatus.textContent = "Ready to process.";

    clearPreviewSection();
}

function clearUploadSection() {
    reportFileInput.value = "";
    reportFileName.textContent = "";
    reportRemoveBtn.classList.add("hidden");
    processUploadBtn.disabled = true;
    uploadStatus.className = "status";
    uploadStatus.textContent = "";
}

function clearPreviewSection() {
    invoiceRows = [];
    previewSection.classList.add("hidden");
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    detectedBadge.textContent = "";
    detectedBadge.className = "detected-badge";
    setWorkflowStep("upload");
}

reportFileInput.addEventListener("change", () => {
    const file = reportFileInput.files[0];
    if (file) {
        handleFileChosen(file);
    } else {
        clearUploadSection();
    }
});

reportRemoveBtn.addEventListener("click", () => {
    clearUploadSection();
    clearPreviewSection();
});

// Dropzone support
const dropTargets = [reportChooseBtn, reportChooseBtn.closest(".upload-card")].filter(Boolean);

dropTargets.forEach((target) => {
    ["dragenter", "dragover"].forEach((eventName) => {
        target.addEventListener(eventName, (e) => {
            e.preventDefault();
            reportChooseBtn.classList.add("drag-over");
            target.classList.add("drag-over");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        target.addEventListener(eventName, (e) => {
            e.preventDefault();
            reportChooseBtn.classList.remove("drag-over");
            target.classList.remove("drag-over");
        });
    });

    target.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (!files || !files.length) return;

        reportFileInput.files = files;
        handleFileChosen(files[0]);
    });
});

const uploadCard = document.getElementById("uploadCard");
const confettiCanvas = document.getElementById("confettiCanvas");

/* =========================
   CELEBRATION CONFETTI ANIMATION
========================= */

function launchCelebration() {
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext("2d");
    if (!ctx) return;

    const width = (confettiCanvas.width = window.innerWidth);
    const height = (confettiCanvas.height = window.innerHeight);

    const colors = ["#1d8a70", "#4fd3ad", "#d16a4f", "#e59462", "#22473f", "#f3b993", "#38bdf8"];
    const particles = [];
    const count = 65;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: width * 0.5 + (Math.random() - 0.5) * 260,
            y: height * 0.45 + (Math.random() - 0.5) * 100,
            vx: (Math.random() - 0.5) * 14,
            vy: -Math.random() * 9 - 4,
            size: Math.random() * 7 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 10,
            alpha: 1
        });
    }

    let frame = 0;
    function render() {
        ctx.clearRect(0, 0, width, height);
        let alive = false;

        particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.38; // gravity
            p.vx *= 0.985;
            p.rotation += p.vRot;
            p.alpha -= 0.014;

            if (p.alpha > 0) {
                alive = true;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
                ctx.restore();
            }
        });

        if (alive && frame++ < 130) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, width, height);
        }
    }
    requestAnimationFrame(render);
}

/* =========================
   PROCESS REPORT (API CALL)
========================= */

processUploadBtn.addEventListener("click", async () => {
    const file = reportFileInput.files[0];
    if (!file) return;

    clearPreviewSection();

    processUploadBtn.disabled = true;
    if (uploadCard) uploadCard.classList.add("processing");

    const statusLabel = selectedMode === "fast_handwritten"
        ? "⚡ Fast extracting handwritten items"
        : "Analyzing document with Groq Vision AI";

    uploadStatus.className = "status loading";
    uploadStatus.innerHTML = `<span class="status-spinner"></span> <span>${statusLabel}... (<span id="liveTimer">0.0s</span>)</span>`;

    const startTime = Date.now();
    const liveTimerEl = document.getElementById("liveTimer");
    const timerInterval = setInterval(() => {
        if (liveTimerEl) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            liveTimerEl.textContent = `${elapsed}s`;
        }
    }, 100);

    try {
        const formData = new FormData();
        formData.append("invoice", file);
        formData.append("mode", selectedMode);

        const response = await fetch(`${API_URL}/api/invoices/process`, {
            method: "POST",
            body: formData
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to process document.");
        }

        invoiceType = data.invoiceType || "handwritten";
        invoiceRows = data.rows || [];

        if (invoiceRows.length === 0) {
            throw new Error("No data rows found in this document.");
        }

        const durationText = data.timeSeconds ? ` in ${data.timeSeconds}s` : "";

        // Dynamically adjust table based on detected document format
        if (invoiceType === "handwritten") {
            detectedBadge.className = "detected-badge handwritten";
            detectedBadge.textContent = "✎ Handwritten Slip (4 Columns)";
            previewSubtitle.textContent = `Extracted ${invoiceRows.length} items${durationText}. Click any cell to edit details before downloading.`;
            renderHandwrittenTable(invoiceRows);
        } else {
            detectedBadge.className = "detected-badge computer";
            detectedBadge.textContent = "▤ Computer Report (12 Columns)";
            previewSubtitle.textContent = `Extracted ${invoiceRows.length} items${durationText}. Click any cell to edit details before downloading.`;
            renderComputerTable(invoiceRows);
        }

        previewSection.classList.remove("hidden");
        setWorkflowStep("review");

        uploadStatus.className = "status success";
        uploadStatus.textContent = `⚡ Extracted ${invoiceRows.length} rows successfully${durationText}!`;

        // Launch celebratory confetti effect!
        launchCelebration();

        setTimeout(() => {
            previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);

    } catch (error) {
        console.error("Processing error:", error);
        uploadStatus.className = "status error";
        uploadStatus.textContent = error.message || "An error occurred while processing the document.";
    } finally {
        clearInterval(timerInterval);
        if (uploadCard) uploadCard.classList.remove("processing");
        processUploadBtn.disabled = reportFileInput.files.length === 0;
    }
});

/* =========================
   ADD ROW ACTION
========================= */

if (addRowBtn) {
    addRowBtn.addEventListener("click", () => {
        if (invoiceType === "handwritten") {
            const newRow = {
                srNo: invoiceRows.length + 1,
                itemName: "New Item",
                packSize: "-",
                quantity: 1
            };
            invoiceRows.push(newRow);
            renderHandwrittenTable(invoiceRows);
        } else {
            const newRow = {
                itemDescription: "New Item",
                packSize: "-",
                openingQty: "-",
                openingValue: "-",
                receiptQty: "-",
                receiptValue: "-",
                issueQty: "-",
                issueValue: "-",
                closingQty: "-",
                closingValue: "-",
                dumpQty: "-",
                mExp: "-"
            };
            invoiceRows.push(newRow);
            renderComputerTable(invoiceRows);
        }
    });
}

/* =========================
   RENDER HANDWRITTEN TABLE (4 COLUMNS)
========================= */

function renderHandwrittenTable(rows) {
    invoiceTable.removeAttribute("style");
    invoiceTable.classList.remove("computer-table");
    invoiceTable.classList.add("handwritten-table");
    invoiceTable.style.tableLayout = "fixed";
    invoiceTable.style.width = "100%";
    invoiceTable.style.minWidth = "600px";

    tableHead.innerHTML = `
        <tr>
            <th style="width: 10%;">SR.NO</th>
            <th style="width: 46%;">ITEM NAME</th>
            <th style="width: 18%;">PACK SIZE</th>
            <th style="width: 18%;">QUANTITY</th>
            <th style="width: 8%;"></th>
        </tr>
    `;

    tableBody.innerHTML = "";

    rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        tr.style.setProperty("--row-index", rowIndex);
        const fields = ["srNo", "itemName", "packSize", "quantity"];

        fields.forEach((field) => {
            const td = document.createElement("td");
            td.contentEditable = "true";
            td.textContent = row[field] ?? "";

            td.addEventListener("input", () => {
                invoiceRows[rowIndex][field] = td.textContent.trim();
            });

            tr.appendChild(td);
        });

        // Delete Row button cell
        const actionTd = document.createElement("td");
        actionTd.style.textAlign = "center";
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.innerHTML = "&times;";
        delBtn.title = "Delete row";
        delBtn.className = "row-delete-btn";
        delBtn.addEventListener("click", () => {
            invoiceRows.splice(rowIndex, 1);
            // Re-index srNo for handwritten
            invoiceRows.forEach((r, idx) => { r.srNo = idx + 1; });
            renderHandwrittenTable(invoiceRows);
        });
        actionTd.appendChild(delBtn);
        tr.appendChild(actionTd);

        tableBody.appendChild(tr);
    });
}

/* =========================
   RENDER COMPUTER TABLE (12 COLUMNS)
========================= */

function renderComputerTable(rows) {
    invoiceTable.removeAttribute("style");
    invoiceTable.classList.remove("handwritten-table");
    invoiceTable.classList.add("computer-table");
    invoiceTable.style.tableLayout = "auto";
    invoiceTable.style.width = "max-content";
    invoiceTable.style.minWidth = "1200px";

    tableHead.innerHTML = `
        <tr>
            <th>ITEM DESCRIPTION</th>
            <th>PACK SIZE</th>
            <th>OPENING QTY</th>
            <th>OPENING VALUE</th>
            <th>RECEIPT QTY</th>
            <th>RECEIPT VALUE</th>
            <th>ISSUE QTY</th>
            <th>ISSUE VALUE</th>
            <th>CLOSING QTY</th>
            <th>CLOSING VALUE</th>
            <th>DUMP QTY</th>
            <th>M.EXP</th>
            <th></th>
        </tr>
    `;

    tableBody.innerHTML = "";

    const fields = [
        "itemDescription",
        "packSize",
        "openingQty",
        "openingValue",
        "receiptQty",
        "receiptValue",
        "issueQty",
        "issueValue",
        "closingQty",
        "closingValue",
        "dumpQty",
        "mExp"
    ];

    rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        tr.style.setProperty("--row-index", rowIndex);

        fields.forEach((field) => {
            const td = document.createElement("td");
            td.contentEditable = "true";
            td.textContent = row[field] ?? "";

            td.addEventListener("input", () => {
                invoiceRows[rowIndex][field] = td.textContent.trim();
            });

            tr.appendChild(td);
        });

        // Delete Row button cell
        const actionTd = document.createElement("td");
        actionTd.style.textAlign = "center";
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.innerHTML = "&times;";
        delBtn.title = "Delete row";
        delBtn.className = "row-delete-btn";
        delBtn.addEventListener("click", () => {
            invoiceRows.splice(rowIndex, 1);
            renderComputerTable(invoiceRows);
        });
        actionTd.appendChild(delBtn);
        tr.appendChild(actionTd);

        tableBody.appendChild(tr);
    });
}

/* =========================
   DOWNLOAD EXCEL
========================= */

downloadBtn.addEventListener("click", async () => {
    if (!invoiceRows.length) return;

    downloadBtn.disabled = true;
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = "Exporting...";

    try {
        const response = await fetch(`${API_URL}/api/invoices/download`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                invoiceType,
                rows: invoiceRows
            })
        });

        if (!response.ok) {
            throw new Error("Failed to export Excel file.");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = invoiceType === "handwritten" ? "handwritten_report.xlsx" : "computer_report.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setWorkflowStep("export");
        launchCelebration();

    } catch (error) {
        console.error("Download error:", error);
        alert(error.message || "Failed to download Excel file.");
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalText;
    }
});
