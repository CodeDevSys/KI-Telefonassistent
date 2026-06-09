const WebSocket = require("ws");
const { createRealtimeSession } = require("./ai");

function handleMediaStream(twilioSocket, req) {
  let streamSid = null;
  let callSid = null;
  let realtimeSession = null;
  let closeAfterAppointmentTimer = null;

  twilioSocket.on("message", (message) => {
    let event;
    try {
      event = JSON.parse(message.toString());
    } catch (error) {
      console.error("Ungültige Twilio WebSocket Nachricht:", error.message);
      return;
    }

    if (event.event === "start") {
      streamSid = event.start.streamSid;
      callSid = event.start.callSid || getCustomParameter(event, "callSid");
      realtimeSession = startRealtimeSession({
        callSid,
        callerPhone: getCustomParameter(event, "from"),
        twilioSocket,
        getStreamSid: () => streamSid,
        scheduleCallClose: () => {
          closeAfterAppointmentTimer = setTimeout(() => {
            if (twilioSocket.readyState === WebSocket.OPEN) {
              twilioSocket.close();
            }
          }, 10000);
        },
      });
      return;
    }

    if (event.event === "media" && realtimeSession) {
      realtimeSession.appendAudio(event.media.payload);
      return;
    }

    if (event.event === "stop") {
      cleanup();
    }
  });

  twilioSocket.on("close", cleanup);
  twilioSocket.on("error", (error) => {
    console.error("Twilio WebSocket Fehler:", error.message);
    cleanup();
  });

  function cleanup() {
    if (closeAfterAppointmentTimer) {
      clearTimeout(closeAfterAppointmentTimer);
      closeAfterAppointmentTimer = null;
    }

    if (realtimeSession) {
      realtimeSession.close();
      realtimeSession = null;
    }
  }
}

function startRealtimeSession({ callSid, callerPhone, twilioSocket, getStreamSid, scheduleCallClose }) {
  try {
    return createRealtimeSession({
      callSid,
      callerPhone,
      sendAudio: (payload) => sendTwilioAudio(twilioSocket, getStreamSid(), payload),
      clearAudio: () => clearTwilioAudio(twilioSocket, getStreamSid()),
      onError: (error) => console.error("OpenAI Realtime Fehler:", error.message),
      onAppointmentCreated: () => scheduleCallClose(),
    });
  } catch (error) {
    console.error("Realtime Session konnte nicht gestartet werden:", error.message);
    if (twilioSocket.readyState === WebSocket.OPEN) {
      twilioSocket.close();
    }
    return null;
  }
}

function sendTwilioAudio(twilioSocket, streamSid, payload) {
  if (!streamSid || !payload || twilioSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  twilioSocket.send(
    JSON.stringify({
      event: "media",
      streamSid,
      media: {
        payload,
      },
    })
  );
}

function clearTwilioAudio(twilioSocket, streamSid) {
  if (!streamSid || twilioSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  twilioSocket.send(
    JSON.stringify({
      event: "clear",
      streamSid,
    })
  );
}

function getCustomParameter(event, name) {
  const parameters = event.start && event.start.customParameters;
  return parameters ? parameters[name] : "";
}

module.exports = {
  handleMediaStream,
};
