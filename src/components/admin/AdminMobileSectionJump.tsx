"use client";

export function AdminMobileSectionJump({ sections }: { sections: ReadonlyArray<{ id: string; label: string }> }) {
  return (
    <label className="admin-mobile-section-jump">
      <span>Jump to section</span>
      <select aria-label="Jump to editor section" value="" onChange={(event) => {
        const section = document.getElementById(event.target.value);
        if (!section) return;
        window.history.replaceState(null, "", `#${event.target.value}`);
        section.scrollIntoView({ block: "start" });
        section.setAttribute("tabindex", "-1");
        section.focus({ preventScroll: true });
      }}>
        <option value="" disabled>Choose section</option>
        {sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
      </select>
    </label>
  );
}
