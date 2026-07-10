// k6 script for API mutation p95 budget.
// Run: k6 run tests/perf/api.k6.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 200 },
    { duration: "8m", target: 200 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

const API = __ENV.API_BASE || "https://api.justmail.dev";
const TOKEN = __ENV.JM_TOKEN;

export default function () {
  const res = http.get(`${API}/v1/orgs`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
