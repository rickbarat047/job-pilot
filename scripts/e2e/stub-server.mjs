#!/usr/bin/env node
// Isolated test doubles for JP-016 E2E: a fake employer application page and a
// deterministic OpenAI-compatible AI endpoint. Binds to localhost only.

import { createServer } from "node:http";

const port = Number(process.env.E2E_STUB_PORT || 4599);
const host = "127.0.0.1";

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

function html(res, body, status = 200) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

const aiReply = {
  summary:
    "Full-stack engineer with verified experience in Python, React and SQL. Builds reliable web applications, collaborates across product and engineering, and communicates clearly with stakeholders. Focused on practical, tested solutions for real users.",
  coverLetter:
    "Dear Hiring Team, I am excited to apply for this role. My verified background includes Python, React and SQL, and I have used these skills to build and maintain dependable web applications. I work carefully, document decisions, and value clear collaboration with teammates. I would welcome the chance to contribute to your team and to learn from the challenges you are solving. Thank you for considering my application.",
  recruiterEmail:
    "Hello, I hope you are well. I am reaching out about the engineering opportunity at your company. My verified skills include Python, React and SQL, and I have applied them to practical web projects. I am interested in the role because it matches the kind of careful, user-focused engineering I enjoy. I would be glad to share more details and discuss how I can help. Thank you for your time.",
  questions: [
    { question: "Why are you interested in this role?", answer: "The role matches my verified Python, React and SQL experience." },
    { question: "What relevant experience do you bring?", answer: "I have built web applications using Python, React and SQL." },
    { question: "What are your strongest skills for this role?", answer: "Python, React and SQL are my strongest verified skills." },
  ],
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if ((url.pathname === "/chat/completions" || url.pathname === "/v1/chat/completions") && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.model || !Array.isArray(parsed.messages)) return json(res, 400, { error: "invalid request" });
        json(res, 200, { choices: [{ message: { content: JSON.stringify(aiReply) } }] });
      } catch {
        json(res, 400, { error: "invalid json" });
      }
    });
    return;
  }

  if (url.pathname.startsWith("/jobs/") && req.method === "GET") {
    const id = url.pathname.split("/")[2] || "e2e-1";
    html(
      res,
      `<!doctype html><html lang="en"><head><title>Apply - Fixture Technologies</title></head>
<body><h1>Software Engineer at Fixture Technologies</h1>
<form method="post" action="/submit/${encodeURIComponent(id)}">
  <label>Full name <input type="text" name="name" autocomplete="name" /></label>
  <label>Email <input type="email" name="email" autocomplete="email" /></label>
  <button type="submit">Submit application</button>
</form></body></html>`,
    );
    return;
  }

  if (url.pathname.startsWith("/submit/") && req.method === "POST") {
    html(
      res,
      `<!doctype html><html lang="en"><head><title>Confirmation</title></head>
<body><h1>Thank you</h1><p>Your application has been submitted successfully.</p></body></html>`,
    );
    return;
  }

  if (url.pathname === "/health") return json(res, 200, { ok: true });
  json(res, 404, { error: "not found" });
});

server.listen(port, host, () => {
  console.log(`E2E stub server listening on http://${host}:${port}`);
});
