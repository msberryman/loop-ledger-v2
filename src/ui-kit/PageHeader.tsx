// src/ui-kit/PageHeader.tsx
import React from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode; // usually PillRail
};

/**
 * Matches Income/Insights header structure:
 * title on left, filter rail on right; stacks on mobile via CSS.
 */
export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div>
        <h1 className="ui-page-title">{title}</h1>
        {subtitle ? <p className="ui-page-subtitle">{subtitle}</p> : null}
      </div>

      {right ? <div>{right}</div> : null}
    </div>
  );
}
