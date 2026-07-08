"use client";

import { useMemo, useState } from "react";
import { FileText, MessageSquareText, ShieldCheck } from "lucide-react";

import { HoursLog, type HoursEntry } from "@/components/portals/review/hours-log";
import { ReviewQueue, type ReviewAssignment } from "@/components/portals/review/review-queue";
import { SignCeremony } from "@/components/portals/review/sign-ceremony";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_ASSIGNMENTS: ReviewAssignment[] = [
  { id: "a1", docName: "Veritax UK Local File FY2024", docType: "local-file", status: "assigned", redlineCount: 3 },
  { id: "a2", docName: "Group Master File FY2024", docType: "master-file", status: "in-progress", redlineCount: 0 },
  { id: "a3", docName: "Benchmark Study FY2022", docType: "benchmark", status: "signed", redlineCount: 0 },
];

const INITIAL_HOURS: HoursEntry[] = [
  { id: "h1", docId: "a1", docName: "Veritax UK Local File FY2024", hours: 2.5, date: "2025-11-20" },
];

interface ReviewComment {
  id: string;
  assignmentId: string;
  text: string;
}

function ReviewWorkspaceLite({
  assignment,
  comments,
  onAddComment,
  onRequestChanges,
  onOpenSign,
}: {
  assignment: ReviewAssignment;
  comments: ReviewComment[];
  onAddComment: (text: string) => void;
  onRequestChanges: () => void;
  onOpenSign: () => void;
}) {
  const [commentText, setCommentText] = useState("");

  function submitComment() {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setCommentText("");
  }

  return (
    <div className="grid gap-4 tablet:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Workspace lite</h2>
          <p className="text-sm text-muted-foreground">
            Scoped document canvas with redline, comments, and evidence on demand.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Scoped document canvas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-secondary p-4">
              <p className="font-medium">{assignment.docName}</p>
              <p className="mt-2 text-muted-foreground">
                Functional analysis section, tested-party paragraph, and benchmarking support are available in this portal scope.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{assignment.docType}</Badge>
              <Badge variant="outline">{assignment.status}</Badge>
              <Badge variant="outline">{assignment.redlineCount} redlines</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4" />
              Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviewer comments yet.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-border bg-card p-3 text-sm">
                    {comment.text}
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-comment">Add reviewer comment</Label>
              <Textarea
                id="review-comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                rows={3}
              />
              <Button type="button" variant="secondary" onClick={submitComment} disabled={!commentText.trim()}>
                Add comment
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Evidence on demand
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Evidence is limited to shared scope for this engagement.</p>
            <div className="space-y-2">
              <div className="rounded-md border border-border p-2">UK Local File section 3.2</div>
              <div className="rounded-md border border-border p-2">Royalty ICA clause 4.1</div>
              <div className="rounded-md border border-border p-2">Benchmark set support memo</div>
            </div>
            <div className="grid gap-2">
              <Button type="button" onClick={onOpenSign}>Open sign ceremony</Button>
              <Button type="button" variant="outline" onClick={onRequestChanges}>
                Request changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export function ReviewPortalContent() {
  const [assignments, setAssignments] = useState<ReviewAssignment[]>(INITIAL_ASSIGNMENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("queue");
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [hours, setHours] = useState<HoursEntry[]>(INITIAL_HOURS);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedId) ?? null,
    [assignments, selectedId],
  );
  const selectedComments = comments.filter((comment) => comment.assignmentId === selectedId);

  function openAssignment(assignmentId: string) {
    setSelectedId(assignmentId);
    setActiveTab("workspace");
  }

  function updateSelectedStatus(status: ReviewAssignment["status"]) {
    if (!selectedId) return;
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === selectedId ? { ...assignment, status } : assignment,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Review Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assigned documents, scoped evidence, sign-off, and hours for this engagement.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          {selectedAssignment ? <TabsTrigger value="workspace">Workspace</TabsTrigger> : null}
          {selectedAssignment ? <TabsTrigger value="sign">Sign ceremony</TabsTrigger> : null}
          <TabsTrigger value="hours">Hours log</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <ReviewQueue assignments={assignments} onOpen={openAssignment} />
        </TabsContent>

        {selectedAssignment ? (
          <TabsContent value="workspace" className="mt-4">
            <ReviewWorkspaceLite
              assignment={selectedAssignment}
              comments={selectedComments}
              onAddComment={(text) =>
                setComments((current) => [
                  ...current,
                  { id: `c${current.length + 1}`, assignmentId: selectedAssignment.id, text },
                ])
              }
              onRequestChanges={() => updateSelectedStatus("changes-requested")}
              onOpenSign={() => setActiveTab("sign")}
            />
          </TabsContent>
        ) : null}

        {selectedAssignment ? (
          <TabsContent value="sign" className="mt-4">
            <SignCeremony
              docName={selectedAssignment.docName}
              reviewerName="External Reviewer A"
              attestationText="I confirm that I reviewed the shared document and evidence in this portal scope and that my sign-off applies only to the materials made available here."
              onSeal={() => updateSelectedStatus("signed")}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="hours" className="mt-4">
          <HoursLog
            entries={hours}
            onAddEntry={(payload) => {
              const docId = selectedAssignment?.id ?? "general";
              const docName = selectedAssignment?.docName ?? "General review";
              setHours((current) => [
                ...current,
                { id: `h${current.length + 1}`, docId, docName, ...payload },
              ]);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
