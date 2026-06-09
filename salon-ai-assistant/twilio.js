const twilio = require("twilio");

const VoiceResponse = twilio.twiml.VoiceResponse;

function handleIncomingCall(req, res) {
  if (!isValidTwilioRequest(req)) {
    res.status(403).send("Ungültige Twilio Signatur.");
    return;
  }

  const streamUrl = buildStreamUrl(req);
  const response = new VoiceResponse();
  const connect = response.connect();
  const stream = connect.stream({ url: streamUrl });

  stream.parameter({ name: "callSid", value: req.body.CallSid || "" });
  stream.parameter({ name: "from", value: req.body.From || "" });
  stream.parameter({ name: "to", value: req.body.To || "" });

  res.type("text/xml");
  res.send(response.toString());
}

function buildStreamUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    const publicUrl = new URL(process.env.PUBLIC_BASE_URL);
    return `wss://${publicUrl.host}/voice/stream`;
  }

  const host = req.get("host");
  const forwardedProto = req.get("x-forwarded-proto");
  const isPublicHttps =
    forwardedProto === "https" ||
    /ngrok|trycloudflare|loca\.lt|tunnel/i.test(host || "");
  const protocol = isPublicHttps ? "wss" : "ws";

  return `${protocol}://${host}/voice/stream`;
}

function isValidTwilioRequest(req) {
  if (process.env.TWILIO_VALIDATE_WEBHOOKS !== "true") {
    return true;
  }

  if (!process.env.TWILIO_AUTH_TOKEN) {
    console.warn("TWILIO_VALIDATE_WEBHOOKS ist aktiv, aber TWILIO_AUTH_TOKEN fehlt.");
    return false;
  }

  const signature = req.get("x-twilio-signature");
  if (!signature) {
    return false;
  }

  const url = buildWebhookUrl(req);
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body);
}

function buildWebhookUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}${req.originalUrl}`;
  }

  return `${req.protocol}://${req.get("host")}${req.originalUrl}`;
}

module.exports = {
  handleIncomingCall,
  buildStreamUrl,
};
