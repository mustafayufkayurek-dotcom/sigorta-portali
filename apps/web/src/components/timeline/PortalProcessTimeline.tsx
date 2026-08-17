'use client';

import ProcessTimeline from './ProcessTimeline';

const PORTAL_HIDDEN_NOTE_TYPES = ['finance', 'operations'];

export default function PortalProcessTimeline({ claimFileId }: { claimFileId: string }) {
  return (
    <ProcessTimeline
      claimFileId={claimFileId}
      readOnly
      hiddenNoteTypes={PORTAL_HIDDEN_NOTE_TYPES}
    />
  );
}
