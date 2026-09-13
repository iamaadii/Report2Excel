require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const invoiceRoutes = require("./routes/invoiceRoutes");

const app = express();

const PORT = 5000;


/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(
    express.json({
        limit: "10mb"
    })
);


/* =========================
   SERVE FRONTEND
========================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================
   SERVE UPLOADED FILES
========================= */

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);


/* =========================
   INVOICE ROUTES
========================= */

app.use(
    "/api/invoices",
    invoiceRoutes
);


/* =========================
   HEALTH CHECK
========================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Invoice server is running."
        });
    }
);


/* =========================
   ERROR HANDLER
========================= */

app.use(
    (err, req, res, next) => {

        console.error(
            "Server Error:",
            err
        );


        res.status(
            err.status || 500
        ).json({

            success: false,

            message:
                err.message ||
                "Internal server error."
        });
    }
);


/* =========================
   START SERVER
========================= */

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;