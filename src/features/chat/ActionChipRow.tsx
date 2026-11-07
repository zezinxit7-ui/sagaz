/** Indicador de status do cartão de ação. */

export function ActionChipRow({
  status,
}: {
  status: string;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "aguardando confirmação", cls: "text-warning" },
    applied: { label: "aplicada ✓", cls: "text-success" },
    discarded: { label: "descartada", cls: "text-muted" },
    error: { label: "erro", cls: "text-danger" },
  };
  const s = map[status] ?? map.pending!;
  return <span className={`text-xs ${s.cls}`}>{s.label}</span>;
}
