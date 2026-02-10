import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const moltbookLogger = logger.child("Moltbook");

interface MoltbookPost {
  id: string;
  content: string;
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

interface QueuedRequest {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class MoltbookClient {
  private baseUrl: string;
  private authToken: string;
  private lastPostTime: number = 0;
  private lastCommentTime: number = 0;
  private postCooldown: number = 30 * 60 * 1000; // 30 minutes in ms
  private commentCooldown: number = 20 * 1000; // 20 seconds in ms
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;

  constructor() {
    this.baseUrl = config.moltbook.apiUrl;
    this.authToken = config.moltbook.authToken;
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

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
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
        const body: Record<string, unknown> = { content };
        if (submolt) body.submolt = submolt;

        const post = await this.request<MoltbookPost>(
          "POST",
          "/posts",
          body
        );
        this.lastPostTime = Date.now();
        moltbookLogger.info(`Post created: ${post.id}`);
        return post;
      } catch (err) {
        moltbookLogger.error("Failed to create post", err);
        return null;
      }
    });
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
