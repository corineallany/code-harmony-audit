// Upload des médias d’accueil via le même stockage que les photos membres.
import { useState } from "react";
import { ImageCropper, cropStyle, DEFAULT_CROP, type ImageCrop } from "@/components/ImageCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  iconUrl: string;
  setIconUrl: (value: string) => void;
  coverUrl: string;
  setCoverUrl: (value: string) => void;
  coverCrop: ImageCrop;
  setCoverCrop: (value: ImageCrop) => void;
};

export function HomeIdentityMedia({ iconUrl, setIconUrl, coverUrl, setCoverUrl, coverCrop, setCoverCrop }: Props) {
  const [uploading, setUploading] = useState<"icon" | "cover" | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  async function upload(kind: "icon" | "cover", file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Choisis un fichier image.");
    if (file.size > 5 * 1024 * 1024) return void toast.error("L’image ne doit pas dépasser 5 Mo.");
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `app-assets/home/${kind}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("member-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("member-photos").getPublicUrl(path);
      if (kind === "icon") {
        setIconUrl(data.publicUrl);
        toast.success("Logo ajouté. Pense à enregistrer l’identité.");
      } else {
        setCoverUrl(data.publicUrl);
        setCoverCrop(DEFAULT_CROP);
        setCropOpen(true);
        toast.success("Photo de couverture ajoutée — ajuste son cadrage puis enregistre.");
      }
    } catch (e: any) {
      toast.error("Impossible d’ajouter l’image", { description: e?.message });
    } finally {
      setUploading(null);
    }
  }

  return <>
    <div className="space-y-2 rounded-xl border p-4">
      <Label>Logo / icône</Label>
      <p className="text-xs text-muted-foreground">Choisis une image depuis tes fichiers, comme pour les photos du trombinoscope. Une URL reste aussi possible.</p>
      {iconUrl ? <div className="flex items-center gap-3"><img src={iconUrl} alt="Aperçu du logo" className="size-16 rounded-xl border object-cover"/><Button type="button" size="sm" variant="ghost" onClick={()=>setIconUrl("")}>Retirer</Button></div> : null}
      <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading!==null} onChange={(e)=>{const f=e.target.files?.[0];if(f)upload("icon",f);e.currentTarget.value=""}}/>
      <Input value={iconUrl} onChange={e=>setIconUrl(e.target.value)} placeholder="Ou coller une URL d’image"/>
    </div>

    <div className="space-y-2 rounded-xl border p-4 md:col-span-2">
      <Label>Photo de couverture de l’accueil</Label>
      <p className="text-xs text-muted-foreground">Tu peux sélectionner directement une photo depuis ton appareil puis régler son cadrage.</p>
      {coverUrl ? <div className="overflow-hidden rounded-2xl border bg-muted" style={{aspectRatio:"16 / 6"}}><img src={coverUrl} alt="Aperçu de la couverture" className="h-full w-full object-cover" style={cropStyle(coverCrop)}/></div> : null}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-md" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading!==null} onChange={(e)=>{const f=e.target.files?.[0];if(f)upload("cover",f);e.currentTarget.value=""}}/>
        {coverUrl ? <Button type="button" size="sm" variant="outline" onClick={()=>setCropOpen(true)}>Ajuster le cadrage</Button> : null}
        {coverUrl ? <Button type="button" size="sm" variant="ghost" onClick={()=>{setCoverUrl("");setCoverCrop(DEFAULT_CROP)}}>Retirer</Button> : null}
      </div>
      <Input value={coverUrl} onChange={e=>{setCoverUrl(e.target.value);setCoverCrop(DEFAULT_CROP)}} placeholder="Ou coller une URL d’image"/>
    </div>

    {coverUrl ? <ImageCropper open={cropOpen} onOpenChange={setCropOpen} src={coverUrl} value={coverCrop} aspect="16 / 6" title="Ajuster la couverture de l’accueil" onSave={setCoverCrop}/> : null}
  </>;
}
