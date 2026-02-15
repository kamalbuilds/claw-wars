import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const moltbookLogger = logger.child("Moltbook");

interface MoltbookPost {
  id: string;
  content: string;
  title?: string;
  submolt?: string;
  author: string;
  createdAt: string;
  comments: MoltbookComment[];
}

interface MoltbookComment {
  id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: string;
}

interface MoltbookCreateResponse {
  success: boolean;
  post: MoltbookPost;
  verification_required?: boolean;
  verification?: {
    code: string;
    challenge: string;
    expires_at: string;
    instructions: string;
  };
}

interface QueuedRequest {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class MoltbookClient {
  private baseUrl: string;
  private apiKey: string;
  private submolt: string;
  private lastPostTime: number = 0;
  private lastCommentTime: number = 0;
  private postCooldown: number = 30 * 60 * 1000; // 30 minutes in ms
  private commentCooldown: number = 20 * 1000; // 20 seconds in ms
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;

  constructor() {
    this.baseUrl = config.moltbook.apiUrl;
    this.apiKey = config.moltbook.apiKey;
    this.submolt = config.moltbook.submolt;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    moltbookLogger.debug(`${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      const error = new Error(
        `Moltbook API error: ${response.status} ${response.statusText} - ${errorBody}`
      );
      moltbookLogger.error(`API error: ${response.status}`, errorBody);
      throw error;
    }

    const data = (await response.json()) as T;
    return data;
  }

  private async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        const result = await item.execute();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }

    this.processing = false;
  }

  async createPost(
    content: string,
    submolt?: string
  ): Promise<MoltbookPost | null> {
    submolt = submolt || this.submolt;
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;

    if (timeSinceLastPost < this.postCooldown) {
      const waitTime = this.postCooldown - timeSinceLastPost;
      moltbookLogger.info(
        `Rate limited: waiting ${Math.ceil(waitTime / 1000)}s before posting`
      );
      await this.delay(waitTime);
    }

    return this.enqueue(async () => {
      try {
        // API requires title + content + submolt
        const title = content.slice(0, 100).replace(/\n/g, " ");
        const body: Record<string, unknown> = { title, content };
        if (submolt) body.submolt = submolt;

        const resp = await this.request<MoltbookCreateResponse>(
          "POST",
          "/posts",
          body
        );
        this.lastPostTime = Date.now();

        // Handle verification challenge if required
        if (resp.verification_required && resp.verification) {
          await this.solveVerification(resp.verification.code, resp.verification.challenge);
        }

        moltbookLogger.info(`Post created: ${resp.post.id}`);
        return resp.post;
      } catch (err) {
        moltbookLogger.error("Failed to create post", err);
        return null;
      }
    });
  }

  /**
   * Solve Moltbook's math verification challenge.
   * Challenges are formatted like: "A] LoB-sTeR ]ClA-w^ FoRcE ]Is/ fOrTy ]NeW-ToNs..."
   * Extract the numbers, perform the operation, and POST the answer.
   */
  private async solveVerification(code: string, challenge: string): Promise<void> {
    try {
      // Normalize the challenge text: remove decoration, lowercase
      const cleaned = challenge
        .replace(/[\]\[^/~<+\-]/g, " ")
        .replace(/[A-Z]/g, (c) => c.toLowerCase())
        .replace(/\s+/g, " ")
        .trim();

      moltbookLogger.debug(`Verification challenge (cleaned): ${cleaned}`);

      // Extract numbers from word form
      const wordToNum: Record<string, number> = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
        sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
        twenty: 20, thirty: 30, forty: 40, fifty: 50,
        sixty: 60, seventy: 70, eighty: 80, ninety: 90,
        hundred: 100, thousand: 1000,
      };

      // Parse compound numbers like "forty newtons" or "twenty four newtons"
      const numbers: number[] = [];
      const words = cleaned.split(" ");
      let current = 0;
      let hasNumber = false;

      for (const word of words) {
        const clean = word.replace(/[^a-z]/g, "");
        if (wordToNum[clean] !== undefined) {
          const val = wordToNum[clean];
          if (val === 100) {
            current = (current || 1) * 100;
          } else if (val === 1000) {
            current = (current || 1) * 1000;
          } else if (val >= 20 && val <= 90 && val % 10 === 0) {
            current += val;
          } else {
            current += val;
          }
          hasNumber = true;
        } else if (hasNumber && (clean === "newtons" || clean === "neutons" || clean === "meters" || clean === "kilograms" || clean === "seconds" || clean === "grams")) {
          numbers.push(current);
          current = 0;
          hasNumber = false;
        } else if (/^\d+(\.\d+)?$/.test(clean)) {
          current += parseFloat(clean);
          hasNumber = true;
        }
      }
      if (hasNumber) numbers.push(current);

      // Determine operation from challenge text
      let answer = 0;
      if (cleaned.includes("total") || cleaned.includes("sum") || cleaned.includes("combined") || cleaned.includes("together")) {
        answer = numbers.reduce((a, b) => a + b, 0);
      } else if (cleaned.includes("difference") || cleaned.includes("subtract") || cleaned.includes("minus")) {
        answer = numbers.length >= 2 ? numbers[0] - numbers[1] : numbers[0];
      } else if (cleaned.includes("product") || cleaned.includes("multiply") || cleaned.includes("times")) {
        answer = numbers.reduce((a, b) => a * b, 1);
      } else if (cleaned.includes("divide") || cleaned.includes("ratio") || cleaned.includes("quotient")) {
        answer = numbers.length >= 2 ? numbers[0] / numbers[1] : numbers[0];
      } else {
        // Default: addition (most common)
        answer = numbers.reduce((a, b) => a + b, 0);
      }

      const answerStr = answer.toFixed(2);
      moltbookLogger.debug(`Verification answer: ${answerStr} (numbers found: ${numbers})`);

      await this.request("POST", "/verify", {
        verification_code: code,
        answer: answerStr,
      });

      moltbookLogger.info("Verification solved successfully");
    } catch (err) {
      moltbookLogger.warn("Verification failed (post may remain pending)", err instanceof Error ? err.message : "");
    }
  }

  async createComment(
    postId: string,
    content: string
  ): Promise<MoltbookComment | null> {
    const now = Date.now();
    const timeSinceLastComment = now - this.lastCommentTime;

    if (timeSinceLastComment < this.commentCooldown) {
      const waitTime = this.commentCooldown - timeSinceLastComment;
      moltbookLogger.info(
        `Rate limited: waiting ${Math.ceil(waitTime / 1000)}s before commenting`
      );
      await this.delay(waitTime);
    }

    return this.enqueue(async () => {
      try {
        const comment = await this.request<MoltbookComment>(
          "POST",
          `/posts/${postId}/comments`,
          { content }
        );
        this.lastCommentTime = Date.now();
        moltbookLogger.info(`Comment created on post ${postId}: ${comment.id}`);
        return comment;
      } catch (err) {
        moltbookLogger.error("Failed to create comment", err);
        return null;
      }
    });
  }

  async getPost(postId: string): Promise<MoltbookPost | null> {
    try {
      return await this.request<MoltbookPost>("GET", `/posts/${postId}`);
    } catch (err) {
      moltbookLogger.error(`Failed to get post ${postId}`, err);
      return null;
    }
  }

  async searchPosts(query: string): Promise<MoltbookPost[]> {
    try {
      const results = await this.request<{ posts: MoltbookPost[] }>(
        "GET",
        `/search?q=${encodeURIComponent(query)}`
      );
      return results.posts || [];
    } catch (err) {
      moltbookLogger.error("Failed to search posts", err);
      return [];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const moltbookClient = new MoltbookClient();
