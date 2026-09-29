import assert from "node:assert/strict";
import test from "node:test";
import { buildTelegramMessage, extractLead, normalizeValue } from "../src/index.js";

test("normalizeValue handles arrays", () => {
  assert.equal(normalizeValue(["Source code", "Database"]), "Source code, Database");
});

test("extractLead maps Tally labels", () => {
  const lead = extractLead({
    eventType: "FORM_RESPONSE",
    data: {
      responseId: "resp_123",
      fields: [
        { label: "Name", value: "KC" },
        { label: "Email", value: "kc@example.com" },
        { label: "Company / Team", value: "Acme" },
        { label: "What is going wrong?", value: "Webhook callbacks disappear." },
        { label: "Current stack", value: ".NET / SQL Server / Azure" },
        { label: "Deadline / urgency", value: "Within a few days" },
        { label: "Budget range", value: "US$800–2,000" },
        { label: "What access is available?", value: ["Source code", "Database"] },
      ],
    },
  });

  assert.deepEqual(lead, {
    responseId: "resp_123",
    name: "KC",
    email: "kc@example.com",
    company: "Acme",
    problem: "Webhook callbacks disappear.",
    stack: ".NET / SQL Server / Azure",
    urgency: "Within a few days",
    budget: "US$800–2,000",
    access: "Source code, Database",
  });
});

test("buildTelegramMessage stays concise and high signal", () => {
  const message = buildTelegramMessage({
    responseId: "resp_123",
    name: "KC",
    email: "kc@example.com",
    company: "Acme",
    problem: "Webhook callbacks disappear.",
    stack: ".NET / SQL Server / Azure",
    urgency: "Within a few days",
    budget: "US$800–2,000",
    access: "Source code, Database",
  });

  assert.match(message, /New Cymatic Logic Lead/);
  assert.match(message, /KC · Acme/);
  assert.match(message, /Budget: US\$800–2,000/);
  assert.match(message, /Urgency: Within a few days/);
  assert.match(message, /Full details: Tally \/ Discord/);
});
