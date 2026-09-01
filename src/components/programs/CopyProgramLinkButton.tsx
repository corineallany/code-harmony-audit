import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}

export function CopyProgramLinkButton({ programId }: { programId: string }) {
  const copyLink = async () => {
    const base = window.location.origin + window.location.pathname.replace(/\/programme\/[^/]+.*$/, "");
    const url = `${base}/programme/${programId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (!fallbackCopy(url)) {
        throw new Error("copy_failed");
      }
      toast.success("Lien copié !");
    } catch {
      if (fallbackCopy(url)) toast.success("Lien copié !");
      else toast.error("Impossible de copier le lien. Réessayez depuis un navigateur autorisant le presse-papiers.");
    }
  };

  return <Button size="sm" variant="outline" onClick={copyLink}>🔗 Copier le lien</Button>;
}
