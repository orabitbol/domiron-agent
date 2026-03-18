import type { DraftFull, StoryFrame } from "@/hooks/use-drafts";

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <div
      className="rounded-xl border p-4 space-y-2"
      style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
        {label}
      </p>
      <div className="text-sm leading-relaxed" style={{ color: "#F1F5F9" }}>
        {children}
      </div>
    </div>
  );
}

interface DraftContentPanelProps {
  draft: DraftFull;
}

export function DraftContentPanel({ draft }: DraftContentPanelProps) {
  const storyFrames = draft.storyFrames as StoryFrame[] | null;

  return (
    <div className="space-y-4">
      {draft.goal && (
        <Section label="מטרה">
          <p>{draft.goal}</p>
        </Section>
      )}

      {draft.bestAngle && (
        <Section label="הזווית הטובה ביותר">
          <p>{draft.bestAngle}</p>
        </Section>
      )}

      {draft.hook && (
        <Section label="הוק">
          <p className="font-medium" style={{ color: "#a78bfa" }}>
            {draft.hook}
          </p>
        </Section>
      )}

      {draft.facebookCaption && (
        <Section label="כיתוב פייסבוק">
          <p className="whitespace-pre-wrap">{draft.facebookCaption}</p>
        </Section>
      )}

      {draft.instagramCaption && (
        <Section label="כיתוב אינסטגרם">
          <p className="whitespace-pre-wrap">{draft.instagramCaption}</p>
        </Section>
      )}

      {storyFrames && storyFrames.length > 0 && (
        <Section label="פריימים לסטורי">
          <div className="space-y-2">
            {storyFrames
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((frame) => (
                <div
                  key={frame.order}
                  className="flex gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: "#0F1117" }}
                >
                  <span
                    className="text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: "#2D3148", color: "#94A3B8" }}
                  >
                    {frame.order}
                  </span>
                  <div className="flex-1">
                    <p>{frame.text}</p>
                    {frame.isLogoFrame && (
                      <span
                        className="text-xs mt-1 inline-block px-2 py-0.5 rounded"
                        style={{ backgroundColor: "#2d1b69", color: "#a78bfa" }}
                      >
                        פריים לוגו
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Section>
      )}

      {draft.cta && (
        <Section label="קריאה לפעולה">
          <p>{draft.cta}</p>
        </Section>
      )}

      {draft.hashtags && draft.hashtags.length > 0 && (
        <Section label="האשטגים">
          <div className="flex flex-wrap gap-2">
            {draft.hashtags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded-full"
                style={{ backgroundColor: "#1e3a5f", color: "#60a5fa" }}
              >
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        </Section>
      )}

      {draft.visualDirection && (
        <Section label="כיוון ויזואלי">
          <p>{draft.visualDirection}</p>
        </Section>
      )}

      {draft.whyThisMatters && (
        <Section label="למה זה חשוב">
          <p>{draft.whyThisMatters}</p>
        </Section>
      )}

      {!draft.goal &&
        !draft.bestAngle &&
        !draft.hook &&
        !draft.facebookCaption &&
        !draft.instagramCaption &&
        !storyFrames?.length &&
        !draft.cta &&
        !draft.hashtags?.length &&
        !draft.visualDirection &&
        !draft.whyThisMatters && (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: "#2D3148", color: "#64748B" }}
          >
            אין תוכן לטיוטה זו
          </div>
        )}
    </div>
  );
}
