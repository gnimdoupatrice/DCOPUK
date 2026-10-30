import { useState } from "react";
import { Bell, Mail, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { pointFocalVide, validerPointFocal, type InstitutionFocal, type PointFocalSaisie } from "@/lib/projets";

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-uk-blue focus:ring-2 focus:ring-uk-blue/20";

type Item = PointFocalSaisie & { id?: string };

export function PointsFocauxEditor({
  items,
  onAdd,
  onRemove,
  busy,
}: {
  items: Item[];
  onAdd: (p: PointFocalSaisie) => Promise<string | null> | string | null;
  onRemove: (item: Item, index: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Colonne type="universite" titre="Points focaux — Université de Kara" tone="border-uk-blue/40 bg-uk-blue/5" titreCls="text-uk-blue" items={items} onAdd={onAdd} onRemove={onRemove} busy={busy} />
      <Colonne type="partenaire" titre="Points focaux — Partenaire" tone="border-uk-green/40 bg-uk-green/5" titreCls="text-uk-green" items={items} onAdd={onAdd} onRemove={onRemove} busy={busy} />
    </div>
  );
}

function Colonne({
  type,
  titre,
  tone,
  titreCls,
  items,
  onAdd,
  onRemove,
  busy,
}: {
  type: InstitutionFocal;
  titre: string;
  tone: string;
  titreCls: string;
  items: Item[];
  onAdd: (p: PointFocalSaisie) => Promise<string | null> | string | null;
  onRemove: (item: Item, index: number) => void;
  busy?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [p, setP] = useState<PointFocalSaisie>(pointFocalVide(type));
  const [err, setErr] = useState<string | null>(null);
  const liste = items.map((it, i) => ({ it, i })).filter(({ it }) => it.institution_type === type);

  async function valider() {
    const e = validerPointFocal(p);
    if (e) return setErr(e);
    const r = await onAdd({ ...p, nom: p.nom.trim(), prenom: p.prenom.trim(), email: p.email?.trim().toLowerCase() || null, telephone: p.telephone?.trim() || null, fonction: p.fonction?.trim() || null });
    if (r) return setErr(r);
    setP(pointFocalVide(type));
    setErr(null);
    setOuvert(false);
  }

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${titreCls}`}>{titre}</p>
      <div className="mt-2 space-y-2">
        {liste.length === 0 && <p className="text-xs text-muted-foreground">Aucun point focal.</p>}
        {liste.map(({ it, i }) => (
          <div key={it.id ?? i} className="flex items-start justify-between gap-2 rounded-lg bg-card p-2 text-xs shadow-sm">
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-semibold text-foreground">
                <UserRound className="h-3.5 w-3.5 shrink-0" /> {it.prenom} {it.nom}
              </p>
              {it.fonction && <p className="text-muted-foreground">{it.fonction}</p>}
              {it.email && <p className="flex items-center gap-1 break-all text-muted-foreground"><Mail className="h-3 w-3 shrink-0" />{it.email}</p>}
              {it.telephone && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{it.telephone}</p>}
              {it.recoit_alertes && <p className="mt-0.5 flex items-center gap-1 font-semibold text-uk-orange"><Bell className="h-3 w-3" /> Reçoit les alertes</p>}
            </div>
            <button type="button" disabled={busy} aria-label="Retirer ce point focal" onClick={() => onRemove(it, i)} className="text-destructive hover:opacity-70">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {ouvert ? (
        <div className="mt-2 space-y-1.5 rounded-lg bg-card p-2 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-2">
            <label>Nom *<input value={p.nom} onChange={(e) => setP({ ...p, nom: e.target.value })} className={inputCls} /></label>
            <label>Prénom *<input value={p.prenom} onChange={(e) => setP({ ...p, prenom: e.target.value })} className={inputCls} /></label>
          </div>
          <label className="block">Fonction / qualité<input value={p.fonction ?? ""} onChange={(e) => setP({ ...p, fonction: e.target.value })} className={inputCls} /></label>
          <label className="block">Téléphone / WhatsApp<input type="tel" value={p.telephone ?? ""} onChange={(e) => setP({ ...p, telephone: e.target.value })} className={inputCls} /></label>
          <label className="block">E-mail<input type="email" value={p.email ?? ""} onChange={(e) => setP({ ...p, email: e.target.value })} className={inputCls} /></label>
          <label className="flex items-center gap-2 pt-1 font-medium text-foreground">
            <input type="checkbox" checked={p.recoit_alertes} onChange={(e) => setP({ ...p, recoit_alertes: e.target.checked })} />
            Inclure dans les destinataires des alertes e-mail
          </label>
          {err && <p className="text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setOuvert(false); setErr(null); }} className="rounded-md border border-border px-2.5 py-1">Annuler</button>
            <button type="button" disabled={busy} onClick={valider} className="rounded-md bg-uk-blue px-2.5 py-1 font-semibold text-primary-foreground disabled:opacity-50">Ajouter</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOuvert(true)} className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${titreCls}`}>
          <Plus className="h-3.5 w-3.5" /> Ajouter un point focal
        </button>
      )}
    </div>
  );
}
