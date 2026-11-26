#!/usr/bin/env node
// Isolated test doubles for the JP-016/017 E2E harness: a fake employer site
// that validates submissions and a deterministic OpenAI-compatible AI endpoint.
// Binds to localhost only. Never contacts real employers, AI providers or email.

import { createServer } from "node:http";

const port = Number(process.env.E2E_STUB_PORT || 4599);
const host = "127.0.0.1";

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

function html(res, body, status = 200) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

const aiReply = {
  summary:
    "Verified experience with Python, React and SQL across academic and personal projects. Comfortable building and testing web applications, with honest attention to gaps and a focus on reliable, maintainable delivery for this role.",
  coverLetter:
    "Thank you for considering my application for this position. My background includes verified work with Python, React and SQL, and I have built and tested small web applications that use these technologies together. I am careful to describe only work I have actually done, and I am keen to apply that discipline to the responsibilities described in your posting. The role's emphasis on dependable software matches the way I prefer to work: understand the requirement, implement it clearly, and verify the result. I would welcome the opportunity to discuss how my existing skills and my willingness to learn can contribute to your team. Thank you for your time and consideration.",
  recruiterEmail:
    "Hello, I am writing to express my interest in this role. My verified experience covers Python, React and SQL, including small web applications built and tested end to end. I value clear requirements and careful verification, which is how I approach new work. I would be glad to share more detail about my projects and to learn more about the team's priorities. Thank you for your time.",
  questions: [
    { question: "Why are you interested in this role?", answer: "The role matches my verified Python, React and SQL experience and my interest in reliable web application delivery." },
    { question: "What relevant experience do you bring?", answer: "I have built and tested small applications using Python, React and SQL, and I describe only work I have actually done." },
    { question: "What are your strongest skills for this role?", answer: "Python, React and SQL, together with careful verification of the work I deliver." },
  ],
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if ((url.pathname === "/chat/completions" || url.pathname === "/v1/chat/completions") && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(raw || "{}");
        if (!parsed.model || !Array.isArray(parsed.messages)) {
          json(res, 400, { error: "model and messages are required" });
          return;
        }
        json(res, 200, { choices: [{ message: { content: JSON.stringify(aiReply) } }] });
      } catch {
        json(res, 400, { error: "invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname.startsWith("/jobs/") && req.method === "GET") {
    const id = url.pathname.slice("/jobs/".length);
    html(
      res,
      `<!doctype html><html lang="en"><head><title>Apply</title></head><body><h1>Application for ${id}</h1><form method="post" action="/submit/${encodeURIComponent(id)}${url.search}"><label>Name <input type="text" name="name" required /></label><label>Email <input type="email" name="email" required /></label><button type="submit">Submit application</button></form></body></html>`,
    );
    return;
  }

  if (url.pathname.startsWith("/submit/") && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const fields = new URLSearchParams(raw);
      const name = (fields.get("name") || "").trim();
      const email = (fields.get("email") || "").trim();
      if (url.searchParams.get("ambiguous") === "1") {
        html(
          res,
          `<!doctype html><html lang="en"><head><title>Form received</title></head><body><h1>Form received</h1><p>Your details have been saved for review.</p></body></html>`,
        );
        return;
      }
      if (!name || !email || !email.includes("@")) {
        html(
          res,
          `<!doctype html><html lang="en"><head><title>Validation error</title></head><body><h1>Application not submitted</h1><p>Error: required field missing. Provide a valid name and email before submitting.</p></body></html>`,
          400,
        );
        return;
      }
      html(
        res,
        `<!doctype html><html lang="en"><head><title>Confirmation</title></head><body><h1>Thank you</h1><p>Your application has been submitted successfully.</p></body></html>`,
      );
    });
    return;
  }

  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.listen(port, host, () => {
  console.log(`E2E stub server listening on http://${host}:${port}`);
});
