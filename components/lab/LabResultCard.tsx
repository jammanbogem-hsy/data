"use client";

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function LabResultCard({ icon, title, subtitle, children }: Props) {
  return (
    <section className="m3-card space-y-4">
      <div>
        <h3 className="m3-section-title">
          <span className="m3-icon" style={{ color: "var(--md-primary)" }}>{icon}</span>
          {title}
        </h3>
        {subtitle && <p className="mt-1 m3-body-sm">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function LabErrorCard({ message }: { message: string }) {
  return (
    <div className="m3-card flex items-center gap-3 p-4" style={{ borderColor: "var(--md-error)" }}>
      <span className="m3-icon" style={{ color: "var(--md-error)" }}>error</span>
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--md-error)" }}>분석 실패</div>
        <p className="mt-0.5 m3-body-sm">{message}</p>
      </div>
    </div>
  );
}

export function LabEmptyCard() {
  return (
    <div className="m3-card flex flex-col items-center justify-center py-12 text-center">
      <span className="m3-icon" style={{ fontSize: 40, color: "var(--md-on-surface-variant)" }}>science</span>
      <p className="mt-3 m3-body-sm">키워드를 입력하고 실험을 시작해보세요.</p>
    </div>
  );
}
