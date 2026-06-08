const twilio = require("twilio");

const VoiceResponse = twilio.twiml.VoiceResponse;

function handleIncomingCall(req, res) {
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

module.exports = {
  handleIncomingCall,
  buildStreamUrl,
};
