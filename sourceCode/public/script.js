const API_URL = "";

let invoiceType = "";
let invoiceRows = [];

const workflowSteps = Array.from(document.querySelectorAll("[data-step]"));
const workflowOrder = ["upload", "review", "export"];

function setWorkflowStep(currentStep) {
    const currentIndex = workflowOrder.indexOf(currentStep);

    workflowSteps.forEach((stepElement) => {
        const stepIndex = workflowOrder.indexOf(stepElement.dataset.step);

        stepElement.classList.toggle("active", stepIndex === currentIndex);
        stepElement.classList.toggle("completed", stepIndex < currentIndex);

        if (stepIndex === currentIndex) {
            stepElement.setAttribute("aria-current", "step");
        } else {
            stepElement.removeAttribute("aria-current");
        }
    });
}

function resetWorkflowToUpload() {
    invoiceType = "";
    invoiceRows = [];
    previewSection.classList.add("hidden");
    setWorkflowStep("upload");
    if (tableBody) {
        tableBody.innerHTML = "";
    }
    computerCard?.classList.remove("card-highlight");
    handwrittenCard?.classList.remove("card-highlight");
    if (computerStatus) computerStatus.className = "status";
    if (handwrittenStatus) handwrittenStatus.className = "status";
}

function redirectToReviewSection() {
    if (!previewSection) return;
    previewSection.classList.remove("hidden");
    setWorkflowStep("review");

    // Seamless smooth scroll directly to the review section across all devices
    requestAnimationFrame(() => {
        previewSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
}

workflowSteps.forEach((stepElement) => {
    stepElement.style.cursor = "pointer";
    stepElement.addEventListener("click", () => {
        if (stepElement.dataset.step === "review" && invoiceRows.length > 0) {
            redirectToReviewSection();
        } else if (stepElement.dataset.step === "upload") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
});

setWorkflowStep("upload");

/* =========================
   COMPUTER INVOICE
========================= */

const computerCard = document.getElementById("computerCard");

const computerFile = document.getElementById("computerFile");

const computerFileName = document.getElementById("computerFileName");

const computerChooseBtn = document.getElementById("computerChooseBtn");

const computerUploadBtn = document.getElementById("computerUploadBtn");

const computerRemoveBtn = document.getElementById("computerRemoveBtn");

const computerStatus = document.getElementById("computerStatus");

/* =========================
   HANDWRITTEN INVOICE
========================= */

const handwrittenCard = document.getElementById("handwrittenCard");

const handwrittenFile = document.getElementById("handwrittenFile");

const handwrittenFileName = document.getElementById("handwrittenFileName");

const handwrittenChooseBtn = document.getElementById("handwrittenChooseBtn");

const handwrittenUploadBtn = document.getElementById("handwrittenUploadBtn");

const handwrittenRemoveBtn = document.getElementById("handwrittenRemoveBtn");

const handwrittenStatus = document.getElementById("handwrittenStatus");

function enableDropZone(fileInput, dropZone) {
    const dropTargets = [dropZone, dropZone.closest(".upload-card")].filter(Boolean);

    dropTargets.forEach((target) => {
        ["dragenter", "dragover"].forEach((eventName) => {
            target.addEventListener(eventName, (event) => {
                event.preventDefault();
                dropZone.classList.add("drag-over");
                target.classList.add("drag-over");
            });
        });

        ["dragleave", "drop"].forEach((eventName) => {
            target.addEventListener(eventName, (event) => {
                event.preventDefault();
                dropZone.classList.remove("drag-over");
                target.classList.remove("drag-over");
            });
        });

        target.addEventListener("drop", (event) => {
            const files = event.dataTransfer.files;

            if (!files.length) {
                return;
            }

            fileInput.files = files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });
}

enableDropZone(computerFile, computerChooseBtn);
enableDropZone(handwrittenFile, handwrittenChooseBtn);

/* =========================
   PREVIEW
========================= */

const previewSection = document.getElementById("previewSection");

const tableBody = document.getElementById("tableBody");

const downloadBtn = document.getElementById("downloadBtn");

/*
 * IMPORTANT:
 *
 * We are NOT expecting an element
 * with id="tableHead".
 *
 * We find the existing <thead>
 * from the existing table.
 */
let invoiceTable = null;
let tableHead = null;

if (tableBody) {
    invoiceTable = tableBody.closest("table");

    if (invoiceTable) {
        tableHead = invoiceTable.querySelector("thead");
    }
}

/* =========================
   CHECK PREVIEW ELEMENTS
========================= */

if (!tableBody) {
    console.error("ERROR: #tableBody was not found in index.html");
}

if (!invoiceTable) {
    console.error("ERROR: Preview table was not found.");
}

if (!tableHead) {
    console.error("ERROR: <thead> was not found inside preview table.");
}

/* =========================
   CLEAR & RESET HELPERS
========================= */

function clearComputerSection() {
    computerFile.value = "";
    computerFileName.textContent = "";
    computerUploadBtn.disabled = true;
    computerRemoveBtn.classList.add("hidden");
    computerStatus.className = "status";
    computerStatus.textContent = "";
    computerCard?.classList.remove("card-highlight");
}

function clearHandwrittenSection() {
    handwrittenFile.value = "";
    handwrittenFileName.textContent = "";
    handwrittenUploadBtn.disabled = true;
    handwrittenRemoveBtn.classList.add("hidden");
    handwrittenStatus.className = "status";
    handwrittenStatus.textContent = "";
    handwrittenCard?.classList.remove("card-highlight");
}

function clearPreviewSection() {
    invoiceRows = [];
    invoiceType = "";
    if (previewSection) {
        previewSection.classList.add("hidden");
    }
    if (tableHead) {
        tableHead.innerHTML = "";
    }
    if (tableBody) {
        tableBody.innerHTML = "";
    }
    if (invoiceTable) {
        invoiceTable.removeAttribute("style");
        invoiceTable.classList.remove("computer-table", "handwritten-table");
    }
}

/* =========================
   COMPUTER FILE CHANGE
========================= */

computerFile.addEventListener("change", () => {
    const file = computerFile.files[0];

    if (!file) {
        computerFileName.textContent = "";

        computerUploadBtn.disabled = true;

        computerRemoveBtn.classList.add("hidden");

        computerStatus.textContent = "";

        resetWorkflowToUpload();
        updateUploadSections();

        return;
    }

    // Clear previous handwritten generated data and preview
    clearHandwrittenSection();
    clearPreviewSection();

    computerFileName.textContent = file.name;

    computerUploadBtn.disabled = false;

    computerRemoveBtn.classList.remove("hidden");

    computerStatus.className = "status";
    computerStatus.textContent = "";

    setWorkflowStep("upload");
    updateUploadSections();
});

/* =========================
   HANDWRITTEN FILE CHANGE
========================= */

handwrittenFile.addEventListener("change", () => {
    const file = handwrittenFile.files[0];

    if (!file) {
        handwrittenFileName.textContent = "";

        handwrittenUploadBtn.disabled = true;

        handwrittenRemoveBtn.classList.add("hidden");

        handwrittenStatus.className = "status";
        handwrittenStatus.textContent = "";

        resetWorkflowToUpload();
        updateUploadSections();

        return;
    }

    // Clear previous computer generated data and preview
    clearComputerSection();
    clearPreviewSection();

    handwrittenFileName.textContent = file.name;

    handwrittenUploadBtn.disabled = false;

    handwrittenRemoveBtn.classList.remove("hidden");

    handwrittenStatus.className = "status";
    handwrittenStatus.textContent = "";

    setWorkflowStep("upload");
    updateUploadSections();
});

/* =========================
   UPDATE UPLOAD SECTIONS
========================= */

/*
 * Both invoice types are independent.
 *
 * Selecting a computer-generated invoice
 * must NOT disable handwritten invoice.
 *
 * Selecting a handwritten invoice
 * must NOT disable computer-generated invoice.
 */

function updateUploadSections() {
    /* =========================
         COMPUTER
      ========================= */

    computerCard.classList.remove("disabled-card");

    computerFile.disabled = false;

    computerChooseBtn.classList.remove("disabled");

    computerUploadBtn.disabled = computerFile.files.length === 0;

    /* =========================
         HANDWRITTEN
      ========================= */

    handwrittenCard.classList.remove("disabled-card");

    handwrittenFile.disabled = false;

    handwrittenChooseBtn.classList.remove("disabled");

    handwrittenUploadBtn.disabled = handwrittenFile.files.length === 0;
}

/* =========================
   REMOVE COMPUTER
========================= */

computerRemoveBtn.addEventListener("click", () => {
    computerFile.value = "";

    computerFileName.textContent = "";

    computerStatus.textContent = "";

    computerUploadBtn.disabled = true;

    computerRemoveBtn.classList.add("hidden");

    resetWorkflowToUpload();
    updateUploadSections();
});

/* =========================
   REMOVE HANDWRITTEN
========================= */

handwrittenRemoveBtn.addEventListener("click", () => {
    handwrittenFile.value = "";

    handwrittenFileName.textContent = "";

    handwrittenStatus.textContent = "";

    handwrittenUploadBtn.disabled = true;

    handwrittenRemoveBtn.classList.add("hidden");

    resetWorkflowToUpload();
    updateUploadSections();
});

/* =========================
   PROCESS COMPUTER
========================= */

computerUploadBtn.addEventListener("click", async () => {
    const file = computerFile.files[0];

    if (!file) {
        return;
    }

    // Clear any previous handwritten report and preview so contents never collide
    clearHandwrittenSection();
    clearPreviewSection();

    computerUploadBtn.disabled = true;
    computerStatus.className = "status";
    computerStatus.textContent = "Processing report...";
    handwrittenCard.classList.remove("card-highlight");

    try {
        const formData = new FormData();

        formData.append("invoice", file);

        formData.append("invoiceType", "computer");

        const response = await fetch(`${API_URL}/api/invoices/process`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (data.mismatch) {
                const uploadedFile = file;

                // Clear and delete the uploaded file from the computer section
                computerFile.value = "";
                computerFileName.textContent = "";
                computerUploadBtn.disabled = true;
                computerRemoveBtn.classList.add("hidden");
                updateUploadSections();

                computerStatus.className = "status mismatch-warning";
                computerStatus.innerHTML = `
                    <span>${data.message}</span>
                    <button type="button" class="mismatch-action-btn" id="moveToHandwrittenBtn">
                        Move file to Handwritten section &rarr;
                    </button>
                `;

                // Handle one-tap move to Handwritten section
                document.getElementById("moveToHandwrittenBtn")?.addEventListener("click", () => {
                    try {
                        const dt = new DataTransfer();
                        dt.items.add(uploadedFile);
                        handwrittenFile.files = dt.files;
                        handwrittenFileName.textContent = uploadedFile.name;
                        handwrittenRemoveBtn.classList.remove("hidden");
                        handwrittenUploadBtn.disabled = false;
                        updateUploadSections();
                        handwrittenStatus.className = "status";
                        handwrittenStatus.textContent = "File transferred. Ready to process!";
                    } catch (_) { }

                    handwrittenCard.classList.remove("card-highlight");
                    void handwrittenCard.offsetWidth;
                    handwrittenCard.classList.add("card-highlight");
                    handwrittenCard.scrollIntoView({ behavior: "smooth", block: "center" });
                });

                handwrittenCard.classList.remove("card-highlight");
                void handwrittenCard.offsetWidth; // trigger reflow to replay animation
                handwrittenCard.classList.add("card-highlight");
                setTimeout(() => handwrittenCard.classList.remove("card-highlight"), 4500);

                // Auto-scroll target card into view on small screens
                setTimeout(() => {
                    handwrittenCard.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 400);

                return;
            }
            throw new Error(data.message || "Failed to process report.");
        }

        invoiceType = "computer";

        invoiceRows = data.rows || [];
        renderComputerTable(invoiceRows);

        redirectToReviewSection();

        computerStatus.className = "status success";
        computerStatus.textContent = `Successfully extracted ${invoiceRows.length} rows.`;
    } catch (error) {
        console.error(error);

        computerStatus.className = "status error";
        computerStatus.textContent = error.message || "Failed to process report.";
    } finally {
        computerUploadBtn.disabled = computerFile.files.length === 0;
    }
});

/* =========================
   PROCESS HANDWRITTEN
========================= */

handwrittenUploadBtn.addEventListener("click", async () => {
    const file = handwrittenFile.files[0];

    if (!file) {
        return;
    }

    // Clear any previous computer report and preview so contents never collide
    clearComputerSection();
    clearPreviewSection();

    handwrittenUploadBtn.disabled = true;
    handwrittenStatus.className = "status";
    handwrittenStatus.textContent = "Processing handwritten report...";
    computerCard.classList.remove("card-highlight");

    try {
        const formData = new FormData();

        formData.append("invoice", file);

        formData.append("invoiceType", "handwritten");

        const response = await fetch(`${API_URL}/api/invoices/process`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (data.mismatch) {
                const uploadedFile = file;

                // Clear and delete the uploaded file from the handwritten section
                handwrittenFile.value = "";
                handwrittenFileName.textContent = "";
                handwrittenUploadBtn.disabled = true;
                handwrittenRemoveBtn.classList.add("hidden");
                updateUploadSections();

                handwrittenStatus.className = "status mismatch-warning";
                handwrittenStatus.innerHTML = `
                    <span>${data.message}</span>
                    <button type="button" class="mismatch-action-btn" id="moveToComputerBtn">
                        Move file to Computer-Generated section &rarr;
                    </button>
                `;

                // Handle one-tap move to Computer section
                document.getElementById("moveToComputerBtn")?.addEventListener("click", () => {
                    try {
                        const dt = new DataTransfer();
                        dt.items.add(uploadedFile);
                        computerFile.files = dt.files;
                        computerFileName.textContent = uploadedFile.name;
                        computerRemoveBtn.classList.remove("hidden");
                        computerUploadBtn.disabled = false;
                        updateUploadSections();
                        computerStatus.className = "status";
                        computerStatus.textContent = "File transferred. Ready to process!";
                    } catch (_) { }

                    computerCard.classList.remove("card-highlight");
                    void computerCard.offsetWidth;
                    computerCard.classList.add("card-highlight");
                    computerCard.scrollIntoView({ behavior: "smooth", block: "center" });
                });

                computerCard.classList.remove("card-highlight");
                void computerCard.offsetWidth; // trigger reflow to replay animation
                computerCard.classList.add("card-highlight");
                setTimeout(() => computerCard.classList.remove("card-highlight"), 4500);

                // Auto-scroll target card into view on small screens
                setTimeout(() => {
                    computerCard.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 400);

                return;
            }
            throw new Error(data.message || "Failed to process report.");
        }

        invoiceType = "handwritten";
        invoiceRows = data.rows || [];
        renderHandwrittenTable(invoiceRows);

        redirectToReviewSection();

        handwrittenStatus.className = "status success";
        handwrittenStatus.textContent = `Successfully extracted ${invoiceRows.length} rows.`;
    } catch (error) {
        console.error(error);

        handwrittenStatus.className = "status error";
        handwrittenStatus.textContent =
            error.message || "Failed to process report.";
    } finally {
        handwrittenUploadBtn.disabled = handwrittenFile.files.length === 0;
    }
});

/* =========================
   RENDER HANDWRITTEN TABLE
========================= */

function renderHandwrittenTable(rows) {
    if (!tableHead || !tableBody) {
        console.error("Preview table elements are missing.");

        return;
    }

    /*
     * Clean slate table styling for handwritten table
     */
    invoiceTable.removeAttribute("style");
    invoiceTable.classList.remove("computer-table");
    invoiceTable.classList.add("handwritten-table");
    invoiceTable.style.tableLayout = "fixed";
    invoiceTable.style.width = "100%";
    invoiceTable.style.minWidth = "600px";

    /*
     * EXACT handwritten headers.
     */
    tableHead.innerHTML = `
    <tr>
        <th style="width: 10%;">SR.NO</th>
        <th style="width: 50%;">ITEM NAME</th>
        <th style="width: 22%;">PACK SIZE</th>
        <th style="width: 18%;">QUANTITY</th>
    </tr>
`;

    tableBody.innerHTML = "";

    rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");

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

        tableBody.appendChild(tr);
    });
}

/* =========================
   RENDER COMPUTER TABLE
========================= */

function renderComputerTable(rows) {
    if (!tableHead || !tableBody) {
        console.error("Preview table elements are missing.");

        return;
    }

    /*
     * Clean slate table styling for computer-generated table (12 columns)
     */
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
        </tr>
    `;

    tableBody.innerHTML = "";

    rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");

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
            "mExp",
        ];

        fields.forEach((field) => {
            const td = document.createElement("td");

            td.contentEditable = "true";

            td.textContent = row[field] ?? "";

            td.addEventListener("input", () => {
                invoiceRows[rowIndex][field] = td.textContent.trim();
            });

            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}

/* =========================
   DOWNLOAD EXCEL
========================= */

downloadBtn.addEventListener("click", async () => {
    try {
        if (!Array.isArray(invoiceRows) || invoiceRows.length === 0) {
            alert("No report data available.");

            return;
        }

        if (invoiceType !== "computer" && invoiceType !== "handwritten") {
            alert("Report type is not selected.");

            return;
        }

        downloadBtn.disabled = true;

        downloadBtn.textContent = "Creating Excel...";
        setWorkflowStep("export");

        const response = await fetch(`${API_URL}/api/invoices/download`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                rows: invoiceRows,

                invoiceType: invoiceType,
            }),
        });

        if (!response.ok) {
            let message = "Failed to create Excel.";

            try {
                const error = await response.json();

                message = error.message || message;
            } catch (_) { }

            throw new Error(message);
        }

        const blob = await response.blob();

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;

        a.download = "report.xlsx";

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);

        setWorkflowStep("review");

        alert(error.message || "Failed to download Excel.");
    } finally {
        downloadBtn.disabled = false;

        downloadBtn.textContent = "Download Excel";
    }
});

/* =========================
   INITIAL STATE
========================= */

updateUploadSections();
