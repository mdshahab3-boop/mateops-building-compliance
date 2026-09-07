/** Text-based T&M logo mark (no external asset needed). */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-extrabold tracking-tight ${className}`}>
      <span className="text-tm-orange">T</span>
      <span className="text-tm-teal">&amp;</span>
      <span className="text-tm-orange">M</span>
      <span className="ml-2 text-tm-teal/80 font-semibold">Management</span>
    </span>
  );
}

export function BrandBadge() {
  return (
    <div className="flex flex-col leading-none">
      <BrandMark className="text-xl" />
      <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-tm-ink/50">
        Induction &amp; Compliance
      </span>
    </div>
  );
}
