import { useState } from "react";
import { Mail, Plus, X } from "lucide-react";
import { ajouterEmail } from "@/lib/projets";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-uk-blue focus:ring-2 focus:ring-uk-blue/20";

export function EmailsAlerteInput({ value, onChange, label = "E-mail(s) du partenaire" }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const [saisie, setSaisie] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function ajouter() {
    if (!saisie.trim()) return;
    const r = ajouterEmail(value, saisie);
    if (typeof r === "string") return setErr(r);
    onChange(r);
    setSaisie("");
    setErr(null);
  }

  return (
    <div className="text-xs font-medium text-muted-foreground">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          type="email"
          value={saisie}
          placeholder="contact@partenaire.org"
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          className={inputCls}
        />
        <button type="button" onClick={ajouter} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-uk-blue px-3 text-xs font-semibold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>
      {err && <p className="mt-1 text-destructive">{err}</p>}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full bg-uk-blue/10 px-2.5 py-1 text-xs font-medium text-uk-blue">
              <Mail className="h-3 w-3" /> {e}
              <button type="button" aria-label={`Retirer ${e}`} onClick={() => onChange(value.filter((x) => x !== e))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 font-normal">Ces adresses recevront l'alerte en copie. La Direction DCOP la reçoit toujours en premier.</p>
    </div>
  );
}
