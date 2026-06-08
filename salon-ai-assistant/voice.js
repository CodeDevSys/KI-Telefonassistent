const twilio = require("twilio");
const OpenAI = require("openai");
const {
  createAppointment,
  findNextAvailableSlots,
  isSlotAvailable,
  isValidDateString,
  isValidSlotTime,
  isWithinOpeningHours,
} = require("./db");

const VoiceResponse = twilio.twiml.VoiceResponse;

const STATES = {
  STEP_1_GREETING: "STEP_1_GREETING",
  STEP_2_SERVICE: "STEP_2_SERVICE",
  STEP_3_DATETIME: "STEP_3_DATETIME",
  STEP_4_AVAILABILITY_CHECK: "STEP_4_AVAILABILITY_CHECK",
  STEP_5_NAME: "STEP_5_NAME",
  STEP_6_PHONE: "STEP_6_PHONE",
  STEP_7_SAVE_APPOINTMENT: "STEP_7_SAVE_APPOINTMENT",
  STEP_8_CONFIRMATION: "STEP_8_CONFIRMATION",
};

const conversations = new Map();
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function handleVoiceStart(req, res) {
  const callSid = getCallSid(req);
  conversations.set(callSid, {
    step: STATES.STEP_2_SERVICE,
    service: null,
    appointmentDate: null,
    appointmentTime: null,
    alternatives: [],
    name: null,
    phone: null,
  });

  return prompt(
    res,
    "Hallo, vielen Dank für Ihren Anruf. Wie kann ich Ihnen helfen? Wenn Sie einen Termin vereinbaren möchten, sagen Sie bitte, ob es um Haare schneiden, Haare färben oder Styling geht."
  );
}

async function handleVoiceNext(req, res) {
  const callSid = getCallSid(req);
  const state = conversations.get(callSid);

  if (!state) {
    return handleVoiceStart(req, res);
  }

  const input = getInput(req);
  if (!input) {
    return repeatCurrentQuestion(res, state);
  }

  try {
    if (state.step === STATES.STEP_2_SERVICE) {
      return handleServiceStep(res, state, input);
    }

    if (state.step === STATES.STEP_3_DATETIME) {
      return handleDateTimeStep(res, state, input);
    }

    if (state.step === STATES.STEP_4_AVAILABILITY_CHECK) {
      return handleAlternativeStep(res, state, input);
    }

    if (state.step === STATES.STEP_5_NAME) {
      return handleNameStep(res, state, input);
    }

    if (state.step === STATES.STEP_6_PHONE) {
      return handlePhoneStep(res, state, input, callSid);
    }

    return handleVoiceStart(req, res);
  } catch (error) {
    console.error("Fehler im Voice-Flow:", error);
    return prompt(
      res,
      "Entschuldigung, es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es noch einmal."
    );
  }
}

async function handleServiceStep(res, state, input) {
  const service = await detectService(input);

  if (!service) {
    return prompt(
      res,
      "Gerne. Was muss bei Ihnen gemacht werden? Zur Auswahl stehen Haare schneiden, Haare färben oder Styling."
    );
  }

  state.service = service;
  state.step = STATES.STEP_3_DATETIME;

  return prompt(res, "Gerne. Wann passt es Ihnen am besten?");
}

async function handleDateTimeStep(res, state, input) {
  const parsed = await parseRequestedDateTime(input);

  if (!parsed || !isValidDateString(parsed.date) || !isValidSlotTime(parsed.time)) {
    return prompt(
      res,
      "Ich konnte Datum oder Uhrzeit leider nicht eindeutig verstehen. Bitte nennen Sie den Termin zum Beispiel so: am 15. Juli um 14 Uhr."
    );
  }

  state.appointmentDate = parsed.date;
  state.appointmentTime = parsed.time;

  if (!isWithinOpeningHours(parsed.date, parsed.time)) {
    state.alternatives = await findNextAvailableSlots(parsed.date, parsed.time, 3);
    state.step = STATES.STEP_4_AVAILABILITY_CHECK;

    return prompt(res, buildAlternativePrompt("Zu dieser Zeit haben wir leider geschlossen.", state.alternatives), {
      numDigits: 1,
    });
  }

  const available = await isSlotAvailable(parsed.date, parsed.time);
  if (available) {
    state.step = STATES.STEP_5_NAME;
    return prompt(res, "Dieser Termin ist verfügbar. Wie ist Ihr Vor- und Nachname?");
  }

  state.alternatives = await findNextAvailableSlots(parsed.date, parsed.time, 3);
  state.step = STATES.STEP_4_AVAILABILITY_CHECK;

  return prompt(
    res,
    buildAlternativePrompt("Der gewünschte Termin ist leider bereits vergeben.", state.alternatives),
    { numDigits: 1 }
  );
}

async function handleAlternativeStep(res, state, input) {
  const selectedSlot = await selectAlternativeSlot(input, state.alternatives);

  if (!selectedSlot) {
    return prompt(
      res,
      buildAlternativePrompt("Ich konnte Ihre Auswahl leider nicht verstehen.", state.alternatives),
      { numDigits: 1 }
    );
  }

  const [date, time] = selectedSlot.split(" ");
  const available = await isSlotAvailable(date, time);

  if (!available) {
    state.alternatives = await findNextAvailableSlots(date, time, 3);
    return prompt(
      res,
      buildAlternativePrompt("Dieser Termin wurde gerade vergeben.", state.alternatives),
      { numDigits: 1 }
    );
  }

  state.appointmentDate = date;
  state.appointmentTime = time;
  state.step = STATES.STEP_5_NAME;

  return prompt(res, "Dieser Termin ist verfügbar. Wie ist Ihr Vor- und Nachname?");
}

function handleNameStep(res, state, input) {
  const name = normalizeName(input);

  if (!name) {
    return prompt(res, "Bitte nennen Sie Ihren Vor- und Nachnamen.");
  }

  state.name = name;
  state.step = STATES.STEP_6_PHONE;

  return prompt(res, "Vielen Dank. Wie lautet Ihre Telefonnummer?");
}

async function handlePhoneStep(res, state, input, callSid) {
  const phone = normalizePhone(input);

  if (!phone) {
    return prompt(
      res,
      "Die Telefonnummer ist leider ungültig. Bitte nennen Sie Ihre Telefonnummer noch einmal."
    );
  }

  state.phone = phone;
  state.step = STATES.STEP_7_SAVE_APPOINTMENT;

  try {
    await createAppointment({
      name: state.name,
      phone: state.phone,
      service: state.service,
      appointmentDate: state.appointmentDate,
      appointmentTime: state.appointmentTime,
    });
  } catch (error) {
    if (error.code === "SLOT_TAKEN") {
      state.alternatives = await findNextAvailableSlots(state.appointmentDate, state.appointmentTime, 3);
      state.step = STATES.STEP_4_AVAILABILITY_CHECK;

      return prompt(
        res,
        buildAlternativePrompt("Der gewünschte Termin ist leider bereits vergeben.", state.alternatives),
        { numDigits: 1 }
      );
    }

    throw error;
  }

  state.step = STATES.STEP_8_CONFIRMATION;
  conversations.delete(callSid);

  return endCall(
    res,
    `Vielen Dank. Ich habe Ihren Termin für ${formatGermanDate(state.appointmentDate)} um ${state.appointmentTime} für ${state.service} eingetragen. Auf Wiederhören.`
  );
}

function repeatCurrentQuestion(res, state) {
  if (state.step === STATES.STEP_2_SERVICE) {
    return prompt(res, "Was muss bei Ihnen gemacht werden? Haare schneiden, Haare färben oder Styling?");
  }

  if (state.step === STATES.STEP_3_DATETIME) {
    return prompt(res, "Wann passt es Ihnen am besten?");
  }

  if (state.step === STATES.STEP_4_AVAILABILITY_CHECK) {
    return prompt(res, buildAlternativePrompt("Welcher Termin passt Ihnen am besten?", state.alternatives), {
      numDigits: 1,
    });
  }

  if (state.step === STATES.STEP_5_NAME) {
    return prompt(res, "Wie ist Ihr Vor- und Nachname?");
  }

  if (state.step === STATES.STEP_6_PHONE) {
    return prompt(res, "Wie lautet Ihre Telefonnummer?");
  }

  return prompt(res, "Wie kann ich Ihnen helfen?");
}

async function detectService(input) {
  const fallback = detectServiceFallback(input);
  if (fallback || !openai) {
    return fallback;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Erkenne die gewünschte Friseur-Dienstleistung. Erlaubte Werte sind "Haare schneiden", "Haare färben", "Styling" oder null. Antworte nur als JSON: {"service": "..."}',
        },
        { role: "user", content: input },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    if (["Haare schneiden", "Haare färben", "Styling"].includes(parsed.service)) {
      return parsed.service;
    }
  } catch (error) {
    console.error("OpenAI-Service-Erkennung fehlgeschlagen:", error.message);
  }

  return null;
}

async function parseRequestedDateTime(input) {
  if (openai) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Extrahiere Datum und Uhrzeit aus deutscher Sprache. Heute ist ${today}. ` +
              'Antworte nur als JSON im Format {"date":"YYYY-MM-DD","time":"HH:mm"} oder {"date":null,"time":null}. Minuten müssen 00 oder 30 sein.',
          },
          { role: "user", content: input },
        ],
      });

      const parsed = JSON.parse(completion.choices[0].message.content);
      if (parsed.date && parsed.time) {
        return { date: parsed.date, time: normalizeTime(parsed.time) };
      }
    } catch (error) {
      console.error("OpenAI-Datumserkennung fehlgeschlagen:", error.message);
    }
  }

  return parseRequestedDateTimeFallback(input);
}

function detectServiceFallback(input) {
  const text = normalizeGerman(input);

  if (text.includes("schneid") || text.includes("haarschnitt") || text.includes("spitzen")) {
    return "Haare schneiden";
  }

  if (text.includes("farb") || text.includes("faerb") || text.includes("tonen") || text.includes("toenen")) {
    return "Haare färben";
  }

  if (text.includes("styling") || text.includes("frisur") || text.includes("fohn") || text.includes("foehn")) {
    return "Styling";
  }

  return null;
}

function parseRequestedDateTimeFallback(input) {
  const text = normalizeGerman(input);
  const date = parseDateFallback(text);
  const time = parseTimeFallback(text);

  if (!date || !time) {
    return null;
  }

  return { date, time };
}

function parseDateFallback(text) {
  const today = new Date();
  const currentDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  if (text.includes("uebermorgen")) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 2);
    return formatDate(currentDate);
  }

  if (text.includes("morgen")) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    return formatDate(currentDate);
  }

  if (text.includes("heute")) {
    return formatDate(currentDate);
  }

  const numericMatch = text.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\s*[.\-/]\s*(\d{2,4}))?/);
  if (numericMatch) {
    return buildDate(Number(numericMatch[1]), Number(numericMatch[2]), numericMatch[3], currentDate);
  }

  const monthNames = {
    januar: 1,
    februar: 2,
    marz: 3,
    maerz: 3,
    april: 4,
    mai: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    dezember: 12,
  };
  const monthMatch = text.match(
    /(\d{1,2})\.?\s+(januar|februar|marz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)(?:\s+(\d{2,4}))?/
  );

  if (monthMatch) {
    return buildDate(Number(monthMatch[1]), monthNames[monthMatch[2]], monthMatch[3], currentDate);
  }

  return null;
}

function parseTimeFallback(text) {
  const hourMatch = text.match(/(\d{1,2})\s*uhr(?:\s*(\d{1,2}))?/);
  if (hourMatch) {
    return normalizeTime(`${hourMatch[1]}:${hourMatch[2] || "00"}`);
  }

  const timeMatch = text.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (timeMatch) {
    return normalizeTime(`${timeMatch[1]}:${timeMatch[2]}`);
  }

  const afterUmMatch = text.match(/\bum\s+(\d{1,2})\b/);
  if (afterUmMatch) {
    return normalizeTime(`${afterUmMatch[1]}:00`);
  }

  return null;
}

function buildDate(day, month, rawYear, currentDate) {
  let year = rawYear ? Number(rawYear) : currentDate.getUTCFullYear();
  if (year < 100) {
    year += 2000;
  }

  let candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  if (!rawYear && candidate < currentDate) {
    candidate = new Date(Date.UTC(year + 1, month - 1, day));
  }

  return formatDate(candidate);
}

async function selectAlternativeSlot(input, alternatives) {
  const text = normalizeGerman(input);
  const digit = text.match(/\b([1-3])\b/);

  if (digit && alternatives[Number(digit[1]) - 1]) {
    return alternatives[Number(digit[1]) - 1];
  }

  if (text.includes("erste") || text.includes("erster") || text.includes("eins")) {
    return alternatives[0];
  }

  if (text.includes("zweite") || text.includes("zweiter") || text.includes("zwei")) {
    return alternatives[1];
  }

  if (text.includes("dritte") || text.includes("dritter") || text.includes("drei")) {
    return alternatives[2];
  }

  const parsed = await parseRequestedDateTime(input);
  if (parsed && isValidDateString(parsed.date) && isValidSlotTime(parsed.time)) {
    const requested = `${parsed.date} ${parsed.time}`;
    if (alternatives.includes(requested)) {
      return requested;
    }
  }

  return null;
}

function buildAlternativePrompt(intro, alternatives) {
  const formattedAlternatives = alternatives
    .map((slot, index) => {
      const [date, time] = slot.split(" ");
      return `${index + 1}. ${formatGermanDate(date)} um ${time}`;
    })
    .join(". ");

  return `${intro} Ich könnte Ihnen folgende Termine anbieten: ${formattedAlternatives}. Welcher Termin passt Ihnen am besten?`;
}

function prompt(res, text, options = {}) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: options.input || "speech dtmf",
    action: "/voice/next",
    method: "POST",
    language: "de-DE",
    speechTimeout: "auto",
    finishOnKey: "#",
    ...(options.numDigits ? { numDigits: options.numDigits } : {}),
  });

  gather.say({ language: "de-DE" }, text);
  response.say({ language: "de-DE" }, "Ich habe leider keine Antwort erhalten. Ich wiederhole die Frage.");
  response.redirect({ method: "POST" }, "/voice/next");

  return sendTwiml(res, response);
}

function endCall(res, text) {
  const response = new VoiceResponse();
  response.say({ language: "de-DE" }, text);
  response.hangup();

  return sendTwiml(res, response);
}

function sendTwiml(res, response) {
  res.type("text/xml");
  return res.send(response.toString());
}

function getCallSid(req) {
  return req.body.CallSid || req.ip || "local-test-call";
}

function getInput(req) {
  return String(req.body.SpeechResult || req.body.Digits || "").trim();
}

function normalizeGerman(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .trim();
}

function normalizeName(value) {
  const name = String(value).trim().replace(/\s+/g, " ");
  if (name.length < 3 || /\d/.test(name) || name.split(" ").length < 2) {
    return null;
  }

  return name;
}

function normalizePhone(value) {
  const phone = String(value).trim().replace(/[^\d+]/g, "");
  if (!/^\+?\d{6,20}$/.test(phone)) {
    return null;
  }

  return phone;
}

function normalizeTime(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatGermanDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

module.exports = {
  STATES,
  handleVoiceStart,
  handleVoiceNext,
};
