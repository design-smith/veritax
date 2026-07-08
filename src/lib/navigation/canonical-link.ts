export type CanonicalTarget =
  | { type: "entity"; id: string; tab?: string }
  | { type: "flow"; id: string; tab?: string }
  | { type: "finding"; id: string; tab?: string }
  | { type: "document"; id: string; sectionId?: string; tab?: string }
  | { type: "run"; id: string; tab?: string }
  | { type: "queue_item"; id: string }
  | { type: "view"; surface: string; viewId: string };

export function createCanonicalHref(target: CanonicalTarget): string {
  switch (target.type) {
    case "entity":
      return withQuery(`/graph/entities/${encodePath(target.id)}`, { tab: target.tab });
    case "flow":
      return withQuery(`/graph/flows/${encodePath(target.id)}`, { tab: target.tab });
    case "finding":
      return withQuery(`/findings/${encodePath(target.id)}`, { tab: target.tab });
    case "document":
      return withQuery(`/library/${encodePath(target.id)}`, {
        section: target.sectionId,
        tab: target.tab,
      });
    case "run":
      return withQuery("/runs", { run: target.id, tab: target.tab });
    case "queue_item":
      return withQuery("/verification-queue", { item: target.id });
    case "view":
      return withQuery(`/${encodePath(target.surface)}`, { view: target.viewId });
  }
}

export function createCanonicalUrl(target: CanonicalTarget, origin: string) {
  return new URL(createCanonicalHref(target), origin).toString();
}

export function parseCanonicalHref(href: string): CanonicalTarget | null {
  const url = new URL(href, "https://veritax.local");
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] === "graph" && segments[1] === "entities" && segments[2]) {
    return withOptionalTab({ type: "entity", id: segments[2] }, url);
  }

  if (segments[0] === "graph" && segments[1] === "flows" && segments[2]) {
    return withOptionalTab({ type: "flow", id: segments[2] }, url);
  }

  if (segments[0] === "findings" && segments[1]) {
    return withOptionalTab({ type: "finding", id: segments[1] }, url);
  }

  if (segments[0] === "library" && segments[1]) {
    const sectionId = url.searchParams.get("section") ?? undefined;
    return withOptionalTab({ type: "document", id: segments[1], sectionId }, url);
  }

  if (segments[0] === "runs" && url.searchParams.get("run")) {
    return withOptionalTab({ type: "run", id: url.searchParams.get("run") ?? "" }, url);
  }

  if (segments[0] === "verification-queue" && url.searchParams.get("item")) {
    return { type: "queue_item", id: url.searchParams.get("item") ?? "" };
  }

  if (segments[0] && url.searchParams.get("view")) {
    return { type: "view", surface: segments[0], viewId: url.searchParams.get("view") ?? "" };
  }

  return null;
}

function withOptionalTab<T extends CanonicalTarget>(target: T, url: URL): T {
  const tab = url.searchParams.get("tab");
  if (!tab) {
    return target;
  }

  return { ...target, tab } as T;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function encodePath(value: string) {
  return encodeURIComponent(value);
}
