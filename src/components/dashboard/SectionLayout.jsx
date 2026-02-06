import React from "react";
import ConclusionBar from "./ConclusionBar";
import DerivationPanel from "./DerivationPanel";

export default function SectionLayout({ conclusion, conclusionStatus, derivationNotes = [], children }) {
  return (
    <div className="space-y-5">
      {conclusion && <ConclusionBar text={conclusion} status={conclusionStatus} />}
      
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5">
          {children}
        </div>
        {derivationNotes.length > 0 && (
          <div className="hidden xl:block">
            <div className="sticky top-24">
              <DerivationPanel notes={derivationNotes} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}