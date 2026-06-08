const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const SLOT_MINUTES = 30;
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "salon.sqlite");

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_slot
    ON appointments (appointment_date, appointment_time)
  `);
}

async function getAppointments() {
  return all(`
    SELECT id, name, phone, service, appointment_date, appointment_time, created_at
    FROM appointments
    ORDER BY appointment_date DESC, appointment_time DESC, created_at DESC
  `);
}

async function isSlotAvailable(appointmentDate, appointmentTime) {
  const row = await get(
    `
      SELECT COUNT(*) AS count
      FROM appointments
      WHERE appointment_date = ? AND appointment_time = ?
    `,
    [appointmentDate, appointmentTime]
  );

  return row.count === 0;
}

async function createAppointment({ name, phone, service, appointmentDate, appointmentTime }) {
  if (!isWithinOpeningHours(appointmentDate, appointmentTime)) {
    const error = new Error("Der gewünschte Termin liegt außerhalb der Öffnungszeiten.");
    error.code = "INVALID_SLOT";
    throw error;
  }

  try {
    const result = await run(
      `
        INSERT INTO appointments
          (name, phone, service, appointment_date, appointment_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [name, phone, service, appointmentDate, appointmentTime, new Date().toISOString()]
    );

    return result.id;
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      const slotError = new Error("Der gewünschte Termin ist leider bereits vergeben.");
      slotError.code = "SLOT_TAKEN";
      throw slotError;
    }

    throw error;
  }
}

async function findNextAvailableSlots(startDate, startTime, minimumCount = 3) {
  const slots = [];
  let cursor = addMinutes(startDate, startTime, SLOT_MINUTES);
  let guard = 0;

  while (slots.length < minimumCount && guard < 365 * 48) {
    guard += 1;
    cursor = normalizeToBookableCandidate(cursor.date, cursor.time);

    if (isWithinOpeningHours(cursor.date, cursor.time)) {
      const available = await isSlotAvailable(cursor.date, cursor.time);
      if (available) {
        slots.push(`${cursor.date} ${cursor.time}`);
      }
    }

    cursor = addMinutes(cursor.date, cursor.time, SLOT_MINUTES);
  }

  return slots;
}

function normalizeToBookableCandidate(date, time) {
  let currentDate = date;
  let currentTime = time;

  for (let guard = 0; guard < 14; guard += 1) {
    const openingWindow = getOpeningWindow(currentDate);

    if (!openingWindow) {
      currentDate = addDays(currentDate, 1);
      currentTime = "09:00";
      continue;
    }

    const minutes = toMinutes(currentTime);
    if (minutes < openingWindow.open) {
      currentTime = fromMinutes(openingWindow.open);
      return { date: currentDate, time: currentTime };
    }

    if (minutes + SLOT_MINUTES > openingWindow.close) {
      currentDate = addDays(currentDate, 1);
      currentTime = "09:00";
      continue;
    }

    return { date: currentDate, time: currentTime };
  }

  return { date: currentDate, time: currentTime };
}

function isWithinOpeningHours(date, time) {
  if (!isValidDateString(date) || !isValidSlotTime(time)) {
    return false;
  }

  const openingWindow = getOpeningWindow(date);
  if (!openingWindow) {
    return false;
  }

  const minutes = toMinutes(time);
  return minutes >= openingWindow.open && minutes + SLOT_MINUTES <= openingWindow.close;
}

function getOpeningWindow(date) {
  const day = parseDate(date).getUTCDay();

  if (day === 0) {
    return null;
  }

  if (day === 6) {
    return { open: toMinutes("09:00"), close: toMinutes("14:00") };
  }

  return { open: toMinutes("09:00"), close: toMinutes("18:00") };
}

function isValidDateString(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  return formatDate(parseDate(date)) === date;
}

function isValidSlotTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return false;
  }

  const minutes = toMinutes(time);
  const minutePart = minutes % 60;
  return minutes >= 0 && minutes < 24 * 60 && (minutePart === 0 || minutePart === 30);
}

function parseDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function addDays(date, days) {
  const value = parseDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return formatDate(value);
}

function addMinutes(date, time, minutesToAdd) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  value.setUTCMinutes(value.getUTCMinutes() + minutesToAdd);

  return {
    date: formatDate(value),
    time: `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`,
  };
}

module.exports = {
  SLOT_MINUTES,
  initDb,
  getAppointments,
  isSlotAvailable,
  createAppointment,
  findNextAvailableSlots,
  isWithinOpeningHours,
  isValidDateString,
  isValidSlotTime,
};
