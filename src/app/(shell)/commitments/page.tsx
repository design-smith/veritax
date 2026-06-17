"use client";

import { CommitmentsListView } from "@/components/commitments/commitments-list-view";
import { mockCommitments, mockUsers } from "@/lib/mock";

const ME = mockUsers[2]; // demo: Ikaika Choi
const noop = () => {};

export default function CommitmentsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
      <h1 className="text-2xl font-semibold">Commitments</h1>
      <CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={noop} />
    </div>
  );
}
