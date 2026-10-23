import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CodeBlock } from "@/components/documentation/code-block";
import {
  API_ENDPOINTS,
  API_LIMITS,
  DERIVED_STATES,
  ENDPOINT_GROUPS,
  ERROR_CODES,
  PUBLIC_API_BASE_URL,
  RELATIVE_API_BASE_URL,
  STATUS_GLOSSARY,
  UNAVAILABLE_ENVELOPE,
  curlExample,
  findEndpoint,
  typescriptExample,
  type ApiEndpoint,
  type DataStatus,
  type EndpointGroup,
} from "@/lib/api/registry";

/**
 * The API documentation.
 *
 * Everything on this page is derived from `lib/api/registry.ts`, which is
 * also what the `GET /api/v1` index is generated from and what the registry
 * test checks against the real route files and the real handler responses.
 * Nothing here is typed out twice.
 */

const GROUP_INTRO: Record<EndpointGroup, string> = {
  Reference: "Where to start. The index tells you what exists.",
  Service: "Is it up, what is configured, and what is behind it.",
  Surveillance:
    "The national dengue series, its aggregates, and the anomaly and signal blocks that sit on top of it.",
  Access: "Prototype medication-access indicators. Every record is simulated.",
  Policy: "The evidence behind the policy work, and the copilot that reads it.",
};

const STATUS_TONE: Record<DataStatus, string> = {
  live: "bg-teal-50 text-teal-700 ring-teal-200",
  demo: "bg-amber-50 text-amber-700 ring-amber-200",
  unavailable: "bg-rose-50 text-rose-700 ring-rose-200",
  not_connected: "bg-slate-100 text-slate-600 ring-slate-200",
};

const STATUS_NAME: Record<DataStatus, string> = {
  live: "live",
  demo: "demo",
  unavailable: "unavailable",
  not_connected: "not_connected",
};

function StatusTag({ status }: { status: DataStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_TONE[status]}`}
    >
      {STATUS_NAME[status]}
    </span>
  );
}

function MethodTag({ method }: { method: ApiEndpoint["method"] }) {
  const tone =
    method === "GET"
      ? "bg-slate-100 text-slate-700 ring-slate-200"
      : "bg-indigo-50 text-indigo-700 ring-indigo-200";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ${tone}`}
    >
      {method}
    </span>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const response = JSON.stringify(endpoint.exampleResponse, null, 2);

  return (
    <article
      id={`endpoint-${endpoint.method.toLowerCase()}-${endpoint.path.replace(/\//g, "-")}`}
      className="scroll-mt-20 rounded-lg border border-slate-200 bg-white"
    >
      <header className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <MethodTag method={endpoint.method} />
          <code className="font-mono text-sm font-semibold text-slate-900">
            {`/api/v1${endpoint.path === "/" ? "" : endpoint.path}`}
          </code>
          <StatusTag status={endpoint.status} />
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-900">
          {endpoint.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{endpoint.description}</p>
      </header>

      <div className="space-y-5 px-4 py-4 sm:px-5">
        <p className="text-[13px] leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Access: </span>
          {endpoint.auth}
        </p>

        {endpoint.parameters.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parameters
            </h4>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Type</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Default</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.parameters.map((parameter) => (
                    <tr key={parameter.name} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 align-top">
                        <code className="font-mono text-[13px] font-medium text-slate-900">
                          {parameter.name}
                        </code>
                        {parameter.required ? (
                          <span className="ml-1.5 text-[11px] font-medium text-rose-600">required</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top text-[13px] text-slate-500">
                        {parameter.type}
                      </td>
                      <td className="px-3 py-2 align-top text-[13px] text-slate-500">
                        {parameter.default ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-[13px] leading-relaxed text-slate-600">
                        {parameter.notes}
                        {parameter.allowed ? (
                          <span className="mt-1 block font-mono text-[11px] text-slate-400">
                            {parameter.allowed.join(" · ")}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">This endpoint takes no parameters.</p>
        )}

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Response shape
          </h4>
          <ul className="mt-2 space-y-1">
            {endpoint.responseShape.map((line) => (
              <li key={line} className="font-mono text-[12px] leading-relaxed text-slate-600">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <CodeBlock label="Request" code={curlExample(endpoint, PUBLIC_API_BASE_URL)} />
          <CodeBlock
            label="TypeScript"
            language="typescript"
            code={typescriptExample(endpoint, PUBLIC_API_BASE_URL)}
          />
        </div>

        <CodeBlock
          label="Example response"
          language="json"
          code={response}
          note={
            endpoint.exampleIsTrimmed
              ? "Trimmed for length. Every value below is a real one from a real response."
              : "A real response body."
          }
        />

        {endpoint.errors.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Errors
            </h4>
            <ul className="mt-2 space-y-1.5">
              {endpoint.errors.map((error) => (
                <li key={`${error.status}-${error.code}`} className="text-[13px] leading-relaxed">
                  <span className="font-mono text-[12px] font-semibold text-rose-700">
                    {error.status}
                  </span>
                  <span className="ml-2 font-mono text-[12px] text-slate-500">{error.code}</span>
                  <span className="ml-2 text-slate-600">{error.when}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {endpoint.notes.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h4>
            <ul className="mt-2 space-y-1.5">
              {endpoint.notes.map((note) => (
                <li key={note} className="text-[13px] leading-relaxed text-slate-600">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function DocumentationView() {
  const quickStart = findEndpoint("GET", "/dengue/summary");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Developers"
        title="API documentation"
        subtitle="SIGMA serves a versioned, read-only JSON API. Every response states what kind of data it carries, so a client never has to guess whether a number is an observation, a simulation, or nothing at all."
      />

      <div className="space-y-8">
        <Section id="overview" title="Overview">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 sm:p-5">
            <p>
              The API is served under <code className="font-mono text-[13px] text-slate-900">/api/v1</code>{" "}
              by the same application you are looking at. The public deployment answers on{" "}
              <code className="font-mono text-[13px] text-slate-900">
                {PUBLIC_API_BASE_URL}
              </code>
              , and any deployment of this app serves the same routes under its own origin at{" "}
              <code className="font-mono text-[13px] text-slate-900">{RELATIVE_API_BASE_URL}</code>.
            </p>
            <p className="mt-3">
              Every response is one of two shapes, and there is no third. A success is{" "}
              <code className="font-mono text-[13px] text-slate-900">{"{ data, meta }"}</code>; a
              failure is <code className="font-mono text-[13px] text-slate-900">{"{ error, meta }"}</code>.{" "}
              <code className="font-mono text-[13px] text-slate-900">meta.status</code> is the part to
              branch on, and <code className="font-mono text-[13px] text-slate-900">meta.isSample</code>{" "}
              says whether the records are simulated.
            </p>
            <p className="mt-3">
              The shared request and response types live in the{" "}
              <code className="font-mono text-[13px] text-slate-900">@sigma/contracts</code> package.
              It is types-only, so importing it costs nothing at runtime.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 sm:p-5">
            <p className="font-semibold">Source connectivity is not the same as current data.</p>
            <p className="mt-2">
              The national dengue series is served from a connected source, so its status is{" "}
              <code className="font-mono text-[13px]">live</code>. The newest week it contains ended on{" "}
              <strong>2023-11-25</strong>. A client that shows a live badge for it is telling a reader
              that the figures describe today, which is not true. Check the coverage window in the
              payload before you label anything current.
            </p>
          </div>
        </Section>

        {quickStart ? (
          <Section id="quick-start" title="Quick start">
            <CodeBlock
              label="Request"
              code={curlExample(quickStart, PUBLIC_API_BASE_URL)}
              note="Fifty-two weeks of the national series, with the coverage window attached."
            />
            <CodeBlock
              label="TypeScript"
              language="typescript"
              code={typescriptExample(quickStart, PUBLIC_API_BASE_URL)}
              note="The response type comes from the shared contract package."
            />
          </Section>
        ) : null}

        <Section id="endpoints" title="Endpoints">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 font-medium text-slate-600">Method</th>
                  <th className="px-3 py-2 font-medium text-slate-600">Path</th>
                  <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 font-medium text-slate-600">What it does</th>
                </tr>
              </thead>
              <tbody>
                {API_ENDPOINTS.map((endpoint) => (
                  <tr key={`${endpoint.method} ${endpoint.path}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 align-top">
                      <MethodTag method={endpoint.method} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className="font-mono text-[13px] text-slate-900">
                        {`/api/v1${endpoint.path === "/" ? "" : endpoint.path}`}
                      </code>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <StatusTag status={endpoint.status} />
                    </td>
                    <td className="px-3 py-2 align-top text-[13px] text-slate-600">
                      {endpoint.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {ENDPOINT_GROUPS.map((group) => {
          const endpoints = API_ENDPOINTS.filter((endpoint) => endpoint.group === group);
          if (endpoints.length === 0) return null;
          return (
            <section key={group} id={`group-${group.toLowerCase()}`} className="scroll-mt-20">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">{group}</h2>
              <p className="mt-1 text-sm text-slate-500">{GROUP_INTRO[group]}</p>
              <div className="mt-4 space-y-4">
                {endpoints.map((endpoint) => (
                  <EndpointCard key={`${endpoint.method} ${endpoint.path}`} endpoint={endpoint} />
                ))}
              </div>
            </section>
          );
        })}

        <Section id="data-status" title="Data status">
          <p className="text-sm leading-relaxed text-slate-600">
            The shared contract defines four statuses, and these are the only values{" "}
            <code className="font-mono text-[13px] text-slate-900">meta.status</code> can carry.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 font-medium text-slate-600">Meaning</th>
                  <th className="px-3 py-2 font-medium text-slate-600">What a client should do</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_GLOSSARY.map((entry) => (
                  <tr key={entry.status} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="px-3 py-3">
                      <StatusTag status={entry.status} />
                      <span className="mt-1 block text-[13px] text-slate-600">{entry.label}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-[13px] leading-relaxed text-slate-600">
                      {entry.meaning}
                    </td>
                    <td className="px-3 py-3 align-top text-[13px] leading-relaxed text-slate-600">
                      {entry.guidance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-900">States a client may derive</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              These are not API statuses. The API never sends them; a client computes them from the
              payload.
            </p>
            <ul className="mt-3 space-y-3">
              {DERIVED_STATES.map((state) => (
                <li key={state.label}>
                  <p className="text-[13px] font-semibold text-slate-900">{state.label}</p>
                  <p className="text-[13px] leading-relaxed text-slate-600">{state.meaning}</p>
                  <p className="text-[13px] leading-relaxed text-slate-500">{state.rule}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="errors" title="Errors">
          <p className="text-sm leading-relaxed text-slate-600">{UNAVAILABLE_ENVELOPE}</p>
          <p className="text-sm leading-relaxed text-slate-600">
            Branch on the HTTP status code first and on{" "}
            <code className="font-mono text-[13px] text-slate-900">error.code</code> second. Messages
            are written to be shown to a user: internal exceptions, stack traces, file paths and
            environment values never appear in a response.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 font-medium text-slate-600">HTTP</th>
                  <th className="px-3 py-2 font-medium text-slate-600">Code</th>
                  <th className="px-3 py-2 font-medium text-slate-600">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {ERROR_CODES.map((error) => (
                  <tr key={error.code} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-rose-700">
                      {error.status}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px] text-slate-700">{error.code}</td>
                    <td className="px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
                      {error.meaning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="limits" title="Limits">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 font-medium text-slate-600">Limit</th>
                  <th className="px-3 py-2 font-medium text-slate-600">Value</th>
                </tr>
              </thead>
              <tbody>
                {API_LIMITS.map((limit) => (
                  <tr key={limit.limit} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-[13px] text-slate-600">{limit.limit}</td>
                    <td className="px-3 py-2 font-mono text-[13px] text-slate-900 tabular-nums">
                      {limit.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="access" title="Access and authentication">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 sm:p-5">
            <p>
              There is no authentication. No endpoint reads an API key, a bearer token or a session,
              and none of them requires one. The data is either public, or simulated.
            </p>
            <p className="mt-3">
              One endpoint reaches a paid external service:{" "}
              <code className="font-mono text-[13px] text-slate-900">POST /api/v1/chat</code>. Its
              provider key is read from the server environment, is never sent to a client, and is never
              exposed in the browser bundle. It is rate limited to 30 requests per 60 seconds per IP
              address, and it refuses the request with{" "}
              <code className="font-mono text-[13px] text-slate-900">not_configured</code> rather
              than answering with a placeholder when no provider is configured.
            </p>
            <p className="mt-3">
              This is a prototype deployment, not a hardened public API. There is no API key
              management, no quota beyond the copilot rate limit, and no per-consumer accounting. Do
              not build on the assumption that it is unrestricted.
            </p>
          </div>
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="space-y-2">
            {[
              "The dengue series is national and historical: 2012-12-30 to 2023-11-25, with 544 of 569 expected weeks recorded. Sub-national reporting is not connected.",
              "Missing weeks are absent, never zero-filled and never interpolated. A gap in a chart is a week with no record.",
              "The anomaly engine is implemented in the Python data track but is not connected to this API, so no anomaly score is served. An empty anomaly list is not evidence that no outbreak is occurring.",
              "Every ACCESS record is simulated. A facility listed there has a demo record; that does not establish that it is operating, stocked, staffed or clinically accessible.",
              "The policy evidence pack is a curated research artefact, not an exhaustive census of Philippine LGUs, and many budget figures are planned amounts rather than awards, payments or expenditure.",
              "Policy Copilot replies are generated over demo evidence. They are not a verified government position, not an official advisory, and not a clinical or legal recommendation.",
              "SIGMA does not confirm outbreaks, diagnose patients, or prescribe policy.",
            ].map((line) => (
              <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-slate-600">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {line}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
