const WebSocket = require("ws");
const {
  checkAvailability,
  createAppointment,
  getAvailableSlots,
} = require("./db");

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview";
const DEFAULT_REALTIME_VOICE = "alloy";

function createRealtimeSession({ callSid, callerPhone, sendAudio, clearAudio, onError, onAppointmentCreated }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY fehlt. Echte Voice-KI benötigt einen OpenAI API Key.");
  }

  const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL;
  const voice = process.env.OPENAI_REALTIME_VOICE || DEFAULT_REALTIME_VOICE;
  const realtimeUrl = `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`;
  const openAiSocket = new WebSocket(realtimeUrl, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  const pendingAudio = [];
  const completedToolCalls = new Set();
  let isOpen = false;
  let isClosed = false;

  openAiSocket.on("open", () => {
    isOpen = true;
    configureSession(openAiSocket, { callSid, callerPhone, voice });

    while (pendingAudio.length > 0) {
      appendAudio(pendingAudio.shift());
    }

    sendEvent(openAiSocket, {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions:
          "Begrüße den Anrufer jetzt mit genau diesem Satz: Hallo, vielen Dank für Ihren Anruf. Wie kann ich Ihnen helfen?",
      },
    });
  });

  openAiSocket.on("message", async (data) => {
    let event;
    try {
      event = JSON.parse(data.toString());
    } catch (error) {
      onError(error);
      return;
    }

    try {
      await handleRealtimeEvent(event);
    } catch (error) {
      onError(error);
      sendEvent(openAiSocket, {
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions:
            "Sage dem Anrufer auf Deutsch: Entschuldigung, es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
        },
      });
    }
  });

  openAiSocket.on("error", onError);
  openAiSocket.on("close", () => {
    isClosed = true;
  });

  function appendAudio(payload) {
    if (!payload || isClosed) {
      return;
    }

    if (!isOpen) {
      pendingAudio.push(payload);
      return;
    }

    sendEvent(openAiSocket, {
      type: "input_audio_buffer.append",
      audio: payload,
    });
  }

  async function handleRealtimeEvent(event) {
    if (event.type === "response.audio.delta" && event.delta) {
      sendAudio(event.delta);
      return;
    }

    if (event.type === "input_audio_buffer.speech_started") {
      clearAudio();
      sendEvent(openAiSocket, { type: "response.cancel" });
      return;
    }

    if (event.type === "response.function_call_arguments.done") {
      await executeFunctionCall(event.name, event.arguments, event.call_id);
      return;
    }

    if (
      event.type === "response.output_item.done" &&
      event.item &&
      event.item.type === "function_call"
    ) {
      await executeFunctionCall(event.item.name, event.item.arguments, event.item.call_id);
      return;
    }

    if (event.type === "error") {
      const message = event.error && event.error.message ? event.error.message : "OpenAI Realtime Fehler";
      throw new Error(message);
    }
  }

  async function executeFunctionCall(name, rawArguments, callId) {
    if (!name || !callId || completedToolCalls.has(callId)) {
      return;
    }

    completedToolCalls.add(callId);

    let args = {};
    try {
      args = rawArguments ? JSON.parse(rawArguments) : {};
    } catch (error) {
      args = {};
    }

    const output = await runTool(name, args);

    sendEvent(openAiSocket, {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    });

    sendEvent(openAiSocket, {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions:
          "Nutze das Tool-Ergebnis und fahre mit dem strikten Terminbuchungsablauf fort. Sprich kurz, freundlich und ausschließlich auf Deutsch.",
      },
    });

    if (name === "createAppointment" && output.success) {
      onAppointmentCreated(output);
    }
  }

  return {
    appendAudio,
    close() {
      isClosed = true;
      if (openAiSocket.readyState === WebSocket.OPEN || openAiSocket.readyState === WebSocket.CONNECTING) {
        openAiSocket.close();
      }
    },
  };
}

function configureSession(socket, { callSid, callerPhone, voice }) {
  sendEvent(socket, {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: buildSystemInstructions({ callSid, callerPhone }),
      voice,
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      input_audio_transcription: {
        model: "whisper-1",
        language: "de",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
        create_response: true,
        interrupt_response: true,
      },
      tools: buildTools(),
      tool_choice: "auto",
      temperature: 0.7,
    },
  });
}

function buildSystemInstructions({ callSid, callerPhone }) {
  const today = new Date().toISOString().slice(0, 10);
  const callerInfo = callerPhone
    ? `Die Telefonnummer des Anrufers laut Twilio ist ${callerPhone}. Frage trotzdem nach der Telefonnummer und akzeptiere, wenn der Kunde sagt, dass diese Nummer genutzt werden soll.`
    : "Frage die Telefonnummer aktiv ab.";

  return `
Du bist ein deutschsprachiger KI-Telefonassistent für einen Friseursalon.
Dies ist ein echter Telefonanruf über Twilio Media Streams. CallSid: ${callSid || "unbekannt"}.
Heute ist ${today}. ${callerInfo}

Sprich natürlich, freundlich, knapp und ausschließlich auf Deutsch.
Du bist kein Chatbot und erklärst keine Technik.
Du führst strikt eine Terminbuchung durch.

Erlaubte Dienstleistungen:
- Haare schneiden
- Haare färben
- Styling

Jede Dienstleistung dauert 30 Minuten.
Termine müssen immer im Format YYYY-MM-DD und HH:mm verarbeitet werden.
Nur 30-Minuten-Slots sind erlaubt: 09:00, 09:30, 10:00 usw.

Öffnungszeiten:
- Montag bis Freitag: 09:00 bis 18:00
- Samstag: 09:00 bis 14:00
- Sonntag: geschlossen

Pflichtablauf:
1. Begrüße mit: "Hallo, vielen Dank für Ihren Anruf. Wie kann ich Ihnen helfen?"
2. Erkenne die Dienstleistung. Falls unklar, frage: "Gerne. Was muss bei Ihnen gemacht werden?"
3. Frage nach dem Terminwunsch: "Wann passt es Ihnen am besten?"
4. Sobald Dienstleistung, Datum und Uhrzeit bekannt sind, MUSST du checkAvailability aufrufen.
5. Wenn verfügbar, sage: "Dieser Termin ist verfügbar." Frage dann Vorname und Nachname sowie Telefonnummer ab.
6. Wenn belegt oder geschlossen, MUSST du getAvailableSlots aufrufen und genau drei Alternativen anbieten.
7. Wenn der Kunde eine Alternative wählt, MUSST du diese erneut mit checkAvailability prüfen.
8. Erst wenn Name, Telefonnummer, Dienstleistung, Datum und Uhrzeit vollständig sind, MUSST du createAppointment aufrufen.
9. Nach erfolgreicher Speicherung bestätigst du exakt mit Datum, Uhrzeit und Dienstleistung.

Wichtig:
- Erfinde niemals freie Termine.
- Speichere niemals ohne createAppointment.
- Behaupte niemals, ein Termin sei gespeichert, bevor createAppointment erfolgreich war.
- Wenn ein Tool einen Fehler meldet, erkläre ihn freundlich und frage nach der fehlenden oder korrekten Information.
`.trim();
}

function buildTools() {
  return [
    {
      type: "function",
      name: "checkAvailability",
      description:
        "Prüft live in PostgreSQL, ob ein 30-Minuten-Termin innerhalb der Öffnungszeiten frei ist.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: {
            type: "string",
            description: "Datum im Format YYYY-MM-DD.",
          },
          time: {
            type: "string",
            description: "Uhrzeit im Format HH:mm, nur volle oder halbe Stunde.",
          },
        },
        required: ["date", "time"],
      },
    },
    {
      type: "function",
      name: "getAvailableSlots",
      description:
        "Findet ab einem gewünschten Datum und einer gewünschten Uhrzeit die nächsten drei freien 30-Minuten-Slots.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: {
            type: "string",
            description: "Startdatum im Format YYYY-MM-DD.",
          },
          time: {
            type: "string",
            description: "Startuhrzeit im Format HH:mm.",
          },
        },
        required: ["date", "time"],
      },
    },
    {
      type: "function",
      name: "createAppointment",
      description:
        "Speichert einen Termin endgültig in PostgreSQL. Verhindert Doppelbuchungen über die Datenbank.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "Vorname und Nachname des Kunden.",
          },
          phone: {
            type: "string",
            description: "Telefonnummer des Kunden.",
          },
          service: {
            type: "string",
            enum: ["Haare schneiden", "Haare färben", "Styling"],
          },
          date: {
            type: "string",
            description: "Datum im Format YYYY-MM-DD.",
          },
          time: {
            type: "string",
            description: "Uhrzeit im Format HH:mm.",
          },
        },
        required: ["name", "phone", "service", "date", "time"],
      },
    },
  ];
}

async function runTool(name, args) {
  if (name === "checkAvailability") {
    const result = await checkAvailability(args.date, args.time);
    return {
      success: true,
      ...result,
    };
  }

  if (name === "getAvailableSlots") {
    const slots = await getAvailableSlots(args.date, args.time, 3);
    return {
      success: true,
      slots,
    };
  }

  if (name === "createAppointment") {
    try {
      const appointmentId = await createAppointment({
        name: args.name,
        phone: args.phone,
        service: args.service,
        date: args.date,
        time: args.time,
      });

      return {
        success: true,
        appointmentId,
        appointment: {
          name: args.name,
          phone: args.phone,
          service: args.service,
          date: args.date,
          time: args.time,
        },
      };
    } catch (error) {
      const slots = await getAvailableSlots(args.date, args.time, 3);
      return {
        success: false,
        code: error.code || "CREATE_APPOINTMENT_FAILED",
        message: error.message,
        alternatives: slots,
      };
    }
  }

  return {
    success: false,
    code: "UNKNOWN_TOOL",
    message: `Unbekanntes Tool: ${name}`,
  };
}

function sendEvent(socket, event) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

module.exports = {
  createRealtimeSession,
};
