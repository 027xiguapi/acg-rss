export class QBittorrentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QBittorrentError";
  }
}

export interface QBittorrentTorrentInfo {
  hash: string;
  name: string;
  state: string;
  progress: number;
  dlspeed: number;
  upspeed: number;
  size: number;
  category: string;
  eta: number;
}

/**
 * Minimal qBittorrent Web API v2 client.
 * One instance per account; call login() before other methods.
 */
export class QBittorrentClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private sid: string | null = null;

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.username = username;
    this.password = password;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v2${path}`, {
        ...init,
        headers: {
          ...(this.sid ? { Cookie: `SID=${this.sid}` } : {}),
          ...init?.headers,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new QBittorrentError(
        `Cannot reach qBittorrent at ${this.baseUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return res;
  }

  async login(): Promise<void> {
    const res = await this.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: this.username,
        password: this.password,
      }),
    });
    const setCookie = res.headers.get("set-cookie");
    const sidMatch = /SID=([^;]+)/.exec(setCookie ?? "");
    const body = (await res.text()).trim();
    if (!res.ok || body !== "Ok." || !sidMatch) {
      throw new QBittorrentError("Login failed: wrong credentials or URL");
    }
    this.sid = sidMatch[1];
  }

  async getVersion(): Promise<string> {
    const res = await this.request("/app/version");
    if (!res.ok) throw new QBittorrentError(`app/version returned ${res.status}`);
    return (await res.text()).trim();
  }

  /**
   * Add torrents via magnet links and/or direct .torrent URLs.
   * Throws QBittorrentError when qBittorrent rejects the request.
   */
  async addTorrents(opts: {
    urls: string[];
    category?: string;
    savePath?: string;
  }): Promise<void> {
    const params = new URLSearchParams();
    params.set("urls", opts.urls.join("\n"));
    if (opts.category) params.set("category", opts.category);
    if (opts.savePath) params.set("savepath", opts.savePath);

    const res = await this.request("/torrents/add", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const body = (await res.text()).trim();
    if (!res.ok || body !== "Ok.") {
      throw new QBittorrentError(
        `torrents/add failed (${res.status}): ${body || "no response"}`
      );
    }
  }

  /**
   * Fetch info for specific torrent hashes. Empty result means the hash is
   * unknown to this client.
   */
  async getTorrentsInfo(hashes: string[]): Promise<QBittorrentTorrentInfo[]> {
    if (hashes.length === 0) return [];
    const res = await this.request(
      `/torrents/info?hashes=${hashes.join("|")}`
    );
    if (!res.ok) {
      throw new QBittorrentError(`torrents/info returned ${res.status}`);
    }
    return (await res.json()) as QBittorrentTorrentInfo[];
  }
}

/** Map a qBittorrent torrent state to our task status. */
export function mapStateToStatus(state: string): {
  status: "QUEUED" | "DOWNLOADING" | "PAUSED" | "COMPLETED" | "ERROR";
  progress?: number;
} {
  switch (state) {
    case "error":
    case "missingFiles":
      return { status: "ERROR" };
    case "uploading":
    case "stalledUP":
    case "forcedUP":
    case "pausedUP":
    case "queuedUP":
    case "checkingUP":
      return { status: "COMPLETED", progress: 1 };
    case "pausedDL":
      return { status: "PAUSED" };
    case "queuedDL":
      return { status: "QUEUED" };
    default:
      // downloading, metaDL, stalledDL, allocating, checkingDL, forcedDL...
      return { status: "DOWNLOADING" };
  }
}

/**
 * Test a connection with explicit credentials (used by the settings page
 * before anything is saved). Returns the qBittorrent version.
 */
export async function testConnection(
  url: string,
  username: string,
  password: string
): Promise<string> {
  const client = new QBittorrentClient(url, username, password);
  await client.login();
  return client.getVersion();
}
