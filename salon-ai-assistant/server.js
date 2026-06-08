require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const { getAppointments, initDb } = require("./db");
const { handleVoiceNext, handleVoiceStart } = require("./voice");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "salon123";
const SESSION_SECRET = process.env.SESSION_SECRET || "supersecret";

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect(req.session.isLoggedIn ? "/appointments" : "/login");
});

app.get("/login", (req, res) => {
  if (req.session.isLoggedIn) {
    res.redirect("/appointments");
    return;
  }

  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    res.redirect("/login?error=Bitte%20Benutzername%20und%20Passwort%20eingeben.");
    return;
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    res.redirect("/login?error=Ung%C3%BCltige%20Login-Daten.");
    return;
  }

  req.session.isLoggedIn = true;
  res.redirect("/appointments");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/appointments", requireLogin, async (req, res, next) => {
  try {
    const appointments = await getAppointments();
    const template = fs.readFileSync(path.join(__dirname, "views", "appointments.html"), "utf8");
    const rows = renderAppointmentRows(appointments);

    res.send(template.replace("{{APPOINTMENT_ROWS}}", rows));
  } catch (error) {
    next(error);
  }
});

app.post("/voice", handleVoiceStart);
app.post("/voice/next", handleVoiceNext);

app.use((req, res) => {
  res.status(404).send("Diese Seite wurde nicht gefunden.");
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send("Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.");
});

function requireLogin(req, res, next) {
  if (!req.session.isLoggedIn) {
    res.redirect("/login?error=Bitte%20melden%20Sie%20sich%20zuerst%20an.");
    return;
  }

  next();
}

function renderAppointmentRows(appointments) {
  if (appointments.length === 0) {
    return '<tr><td colspan="6" class="empty">Noch keine Termine vorhanden.</td></tr>';
  }

  return appointments
    .map(
      (appointment) => `
        <tr>
          <td>${escapeHtml(formatGermanDate(appointment.appointment_date))}</td>
          <td>${escapeHtml(appointment.appointment_time)}</td>
          <td>${escapeHtml(appointment.name)}</td>
          <td>${escapeHtml(appointment.phone)}</td>
          <td>${escapeHtml(appointment.service)}</td>
          <td>${escapeHtml(formatCreatedAt(appointment.created_at))}</td>
        </tr>
      `
    )
    .join("");
}

function formatGermanDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function formatCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Salon KI-Assistent läuft auf http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Datenbank konnte nicht initialisiert werden:", error);
    process.exit(1);
  });
