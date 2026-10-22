import type { Rect } from "@/lib/engine/types";
import { newId, nowIso } from "@/lib/ids";
import { cleanDescription, cleanProjectName, cleanTitle } from "@/lib/issues/sanitize";
import { changeStatus, confirmIssue, dismissIssue, restoreIssue, returnToReview, type IssueEdits } from "@/lib/issues/workflow";
import { openRepository, type QaRepository, type StoredBlob } from "./repository";
import type { Comparison, Issue, IssueStatus } from "./types";

/*
 * One client-side store for comparisons and issues. Every screen reads the same snapshot, so counts in the
 * nav, the workspace and the tracker always agree (AC-08). Changes apply on screen first, then are written
 * to IndexedDB in order; a failed write raises a visible warning instead of failing silently.
 */

export interface QaState {
  ready: boolean;
  persistence: QaRepository["kind"] | null;
  saveError: string | null;
  comparisons: Comparison[];
  issues: Issue[];
}

const INITIAL: QaState = { ready: false, persistence: null, saveError: null, comparisons: [], issues: [] };
const BUG_COUNTER = "bugCounter";
const SAVE_ERROR = "We couldn't save your latest change in this browser. It's still on screen, but it may be lost when you leave this page.";

interface UrlEntry {
  url: Promise<string | null>;
  refs: number;
  revokeTimer?: ReturnType<typeof setTimeout>;
}

export interface NewComparison {
  comparison: Comparison;
  images: StoredBlob[];
  issues: Issue[];
}

export class QaStore {
  private state: QaState = INITIAL;
  private listeners = new Set<() => void>();
  private repo: QaRepository | null = null;
  private initPromise: Promise<void> | null = null;
  private bugCounter = 0;
  private writes: Promise<unknown> = Promise.resolve();
  /** Images created in this tab, kept so the workspace opens instantly and still works if saving failed. */
  private sessionBlobs = new Map<string, Blob>();
  private urls = new Map<string, UrlEntry>();

  constructor(private readonly open: () => Promise<QaRepository> = openRepository) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    void this.init();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;
  getServerSnapshot = () => INITIAL;

  init(): Promise<void> {
    this.initPromise ??= (async () => {
      const repo = await this.open();
      let comparisons: Comparison[] = [];
      let issues: Issue[] = [];
      let counter = 0;
      let saveError: string | null = null;
      try {
        [comparisons, issues, counter] = await Promise.all([repo.listComparisons(), repo.listIssues(), repo.getCounter(BUG_COUNTER)]);
      } catch {
        saveError = "We couldn't read the comparisons saved in this browser.";
      }
      this.repo = repo;
      this.bugCounter = issues.reduce((max, i) => Math.max(max, i.bugNumber ?? 0), counter);
      this.set({ ready: true, persistence: repo.kind, comparisons, issues, saveError });
    })();
    return this.initPromise;
  }

  private set(patch: Partial<QaState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Runs writes one after another so an older write can never land after a newer one. */
  private persist(write: (repo: QaRepository) => Promise<void>): Promise<boolean> {
    const run = this.writes.then(async () => {
      try {
        await this.init();
        await write(this.repo!);
        return true;
      } catch {
        this.set({ saveError: SAVE_ERROR });
        return false;
      }
    });
    this.writes = run;
    return run;
  }

  dismissSaveError() {
    this.set({ saveError: null });
  }

  // ── Comparisons ──────────────────────────────────────────────────────────

  async createComparison({ comparison, images, issues }: NewComparison): Promise<boolean> {
    await this.init();
    for (const image of images) this.sessionBlobs.set(image.id, image.blob);
    this.set({ comparisons: [comparison, ...this.state.comparisons], issues: [...this.state.issues, ...issues] });
    return this.persist((repo) => repo.createComparison(comparison, images, issues));
  }

  updateComparison(id: string, patch: Partial<Pick<Comparison, "projectName" | "regionsRevealed">>) {
    const current = this.state.comparisons.find((c) => c.id === id);
    if (!current) return;
    const next: Comparison = {
      ...current,
      ...patch,
      projectName: patch.projectName !== undefined ? cleanProjectName(patch.projectName) || current.projectName : current.projectName,
      updatedAt: nowIso(),
    };
    this.set({ comparisons: this.state.comparisons.map((c) => (c.id === id ? next : c)) });
    void this.persist((repo) => repo.putComparison(next));
  }

  deleteComparison(id: string) {
    const comparison = this.state.comparisons.find((c) => c.id === id);
    if (!comparison) return;
    this.set({
      comparisons: this.state.comparisons.filter((c) => c.id !== id),
      issues: this.state.issues.filter((i) => i.comparisonId !== id),
    });
    for (const image of [comparison.referenceImage, comparison.implementationImage, comparison.diffMaskImage]) this.sessionBlobs.delete(image.id);
    void this.persist((repo) => repo.deleteComparison(comparison));
  }

  // ── Issues ───────────────────────────────────────────────────────────────

  /** Applies `update` to one issue; returns false when the issue is missing or the change isn't allowed. */
  private updateIssue(id: string, update: (issue: Issue, now: string) => Issue, extraWrite?: (repo: QaRepository) => Promise<void>): boolean {
    const issue = this.state.issues.find((i) => i.id === id);
    if (!issue) return false;
    let next: Issue;
    try {
      next = update(issue, nowIso());
    } catch {
      return false; // e.g. a double click confirming an already-confirmed issue
    }
    if (next === issue) return true;
    this.set({ issues: this.state.issues.map((i) => (i.id === id ? next : i)) });
    void this.persist(async (repo) => {
      await repo.putIssues([next]);
      await extraWrite?.(repo);
    });
    return true;
  }

  confirm(id: string): boolean {
    const issue = this.state.issues.find((i) => i.id === id);
    if (!issue || issue.reviewState !== "Pending") return false;
    const number = issue.bugNumber ?? ++this.bugCounter;
    const counter = this.bugCounter;
    return this.updateIssue(id, (i, now) => confirmIssue(i, number, now), (repo) => repo.setCounter(BUG_COUNTER, counter));
  }

  dismiss(id: string) {
    return this.updateIssue(id, dismissIssue);
  }

  restore(id: string) {
    return this.updateIssue(id, restoreIssue);
  }

  returnToReview(id: string) {
    return this.updateIssue(id, returnToReview);
  }

  setStatus(id: string, status: IssueStatus) {
    return this.updateIssue(id, (i, now) => changeStatus(i, status, now));
  }

  edit(id: string, edits: IssueEdits) {
    return this.updateIssue(id, (issue, now) => {
      const title = edits.title !== undefined ? cleanTitle(edits.title) || issue.title : issue.title;
      const description = edits.description !== undefined ? cleanDescription(edits.description) : issue.description;
      const severity = edits.severity ?? issue.severity;
      if (title === issue.title && description === issue.description && severity === issue.severity) return issue;
      return { ...issue, title, description, severity, updatedAt: now };
    });
  }

  /** P1 manual annotation: a box drawn by the reviewer becomes a confirmed, open bug straight away. */
  addManualIssue(comparisonId: string, region: Rect): Issue | null {
    if (!this.state.comparisons.some((c) => c.id === comparisonId)) return null;
    const now = nowIso();
    const manualCount = this.state.issues.filter((i) => i.comparisonId === comparisonId && i.source === "manual").length;
    const issue: Issue = {
      id: newId(),
      comparisonId,
      label: `M${manualCount + 1}`,
      bugNumber: ++this.bugCounter,
      source: "manual",
      region,
      title: "Manually marked issue",
      description: "",
      severity: "Untriaged",
      reviewState: "Confirmed",
      status: "Open",
      hint: null,
      density: null,
      createdAt: now,
      updatedAt: now,
      confirmedAt: now,
    };
    const counter = this.bugCounter;
    this.set({ issues: [...this.state.issues, issue] });
    void this.persist(async (repo) => {
      await repo.putIssues([issue]);
      await repo.setCounter(BUG_COUNTER, counter);
    });
    return issue;
  }

  // ── Images ───────────────────────────────────────────────────────────────

  async getImageBlob(id: string): Promise<Blob | undefined> {
    const session = this.sessionBlobs.get(id);
    if (session) return session;
    await this.init();
    return this.repo!.getImage(id);
  }

  /** Ref-counted object URLs: many crops of one screenshot share a single URL, revoked shortly after the last user leaves. */
  acquireImageUrl(id: string): Promise<string | null> {
    let entry = this.urls.get(id);
    if (!entry) {
      entry = {
        refs: 0,
        url: this.getImageBlob(id)
          .then((blob) => (blob ? URL.createObjectURL(blob) : null))
          .catch(() => null),
      };
      this.urls.set(id, entry);
    }
    clearTimeout(entry.revokeTimer);
    entry.refs++;
    return entry.url;
  }

  releaseImageUrl(id: string) {
    const entry = this.urls.get(id);
    if (!entry) return;
    entry.refs--;
    if (entry.refs > 0) return;
    entry.revokeTimer = setTimeout(() => {
      if (entry.refs > 0) return;
      this.urls.delete(id);
      void entry.url.then((url) => url && URL.revokeObjectURL(url));
    }, 30_000);
  }
}

export const qaStore = new QaStore();
