import { Socket } from "node:net";
import { TLSSocket } from "node:tls";
import { createHash } from "node:crypto";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

export interface EmailReply {
  uid: number;
  from: string;
  subject: string;
  date: string;
  body: string;
  matchedApplicationId?: string;
}

export class ImapClient {
  private socket: TLSSocket | Socket | null = null;
  private tagCounter = 0;
  private buffer = "";
  private pending: Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }> = new Map();

  constructor(private config: ImapConfig) {}

  private nextTag(): string {
    return `A${++this.tagCounter}`;
  }

  private send(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tag = this.nextTag();
      const fullCommand = `${tag} ${command}\r\n`;
      this.pending.set(tag, { resolve, reject });
      this.socket?.write(fullCommand);
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    const lines = this.buffer.split("\r\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      // Check if this is a tagged response
      const match = line.match(/^A\d+ (OK|NO|BAD)/);
      if (match) {
        const tag = line.split(" ")[0];
        const pending = this.pending.get(tag);
        if (pending) {
          this.pending.delete(tag);
          if (match[1] === "OK") {
            pending.resolve(line);
          } else {
            pending.reject(new Error(line));
          }
        }
      }
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 15000);

      if (this.config.secure) {
        this.socket = new TLSSocket(new Socket(), {
          rejectUnauthorized: false,
        });
        (this.socket as TLSSocket).connect(this.config.port, this.config.host, () => {
          clearTimeout(timeout);
          this.socket?.on("data", (data) => this.handleData(data));
          resolve();
        });
      } else {
        this.socket = new Socket();
        this.socket.connect(this.config.port, this.config.host, () => {
          clearTimeout(timeout);
          this.socket?.on("data", (data) => this.handleData(data));
          resolve();
        });
      }

      this.socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async login(): Promise<void> {
    const result = await this.send(`LOGIN "${this.config.user}" "${this.config.password}"`);
    if (!result.includes("OK")) {
      throw new Error(`Login failed: ${result}`);
    }
  }

  async selectMailbox(mailbox: string = "INBOX"): Promise<void> {
    const result = await this.send(`SELECT ${mailbox}`);
    if (!result.includes("OK")) {
      throw new Error(`Select failed: ${result}`);
    }
  }

  async search(criteria: string): Promise<number[]> {
    const result = await this.send(`SEARCH ${criteria}`);
    const match = result.match(/\* SEARCH (.+)/);
    if (!match) return [];
    return match[1].trim().split(/\s+/).map(Number).filter((n) => !isNaN(n));
  }

  async fetchHeaders(uids: number[]): Promise<EmailReply[]> {
    if (uids.length === 0) return [];

    const results: EmailReply[] = [];
    const uidList = uids.join(",");

    // Fetch headers for all UIDs
    const result = await this.send(`FETCH ${uidList} (UID RFC822.SIZE ENVELOPE BODY[TEXT])`);

    // Parse the response (simplified - real IMAP parsing is more complex)
    const lines = result.split("\r\n");
    let currentUid = 0;
    let currentFrom = "";
    let currentSubject = "";
    let currentDate = "";
    let currentBody = "";

    for (const line of lines) {
      if (line.includes("UID ")) {
        const uidMatch = line.match(/UID (\d+)/);
        if (uidMatch) currentUid = parseInt(uidMatch[1]);
      }
      if (line.includes("ENVELOPE")) {
        const fromMatch = line.match(/ENVELOPE \("([^"]*)"/);
        if (fromMatch) currentFrom = fromMatch[1];
        const subjectMatch = line.match(/ENVELOPE \([^)]*"([^"]*)"/);
        if (subjectMatch) currentSubject = subjectMatch[1];
      }
    }

    if (currentUid > 0) {
      results.push({
        uid: currentUid,
        from: currentFrom,
        subject: currentSubject,
        date: currentDate,
        body: currentBody,
      });
    }

    return results;
  }

  async logout(): Promise<void> {
    try {
      await this.send("LOGOUT");
    } catch {
      // Ignore errors on logout
    }
    this.socket?.destroy();
    this.socket = null;
  }
}

/**
 * Check for email replies related to job applications.
 * Searches the user's INBOX for recent emails that might be employer replies.
 */
export async function checkForReplies(config: ImapConfig, applicationKeywords: string[]): Promise<EmailReply[]> {
  const client = new ImapClient(config);

  try {
    await client.connect();
    await client.login();
    await client.selectMailbox("INBOX");

    // Search for emails from the last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/,/g, "");
    const uids = await client.search(`SINCE ${sinceStr}`);

    // For simplicity, we'll just return the UIDs found
    // A full implementation would fetch and parse each email
    const replies: EmailReply[] = [];

    if (uids.length > 0) {
      // Fetch the most recent 20 emails
      const recentUids = uids.slice(-20);
      const fetched = await client.fetchHeaders(recentUids);

      for (const email of fetched) {
        const subjectLower = email.subject.toLowerCase();
        const bodyLower = email.body.toLowerCase();

        // Check if this email matches any of our application keywords
        for (const keyword of applicationKeywords) {
          const keywordLower = keyword.toLowerCase();
          if (subjectLower.includes(keywordLower) || bodyLower.includes(keywordLower)) {
            replies.push(email);
            break;
          }
        }
      }
    }

    await client.logout();
    return replies;
  } catch (error) {
    console.error("IMAP error:", error);
    try {
      await client.logout();
    } catch {
      // Ignore
    }
    throw error;
  }
}
