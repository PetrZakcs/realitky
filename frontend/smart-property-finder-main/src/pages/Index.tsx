import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";

type SearchFormState = {
  city: string;
  priceMax: string;
  priceM2Max: string;
  roomsFrom: string;
  keywords: string;
  aiScoring: boolean;
};

const initialState: SearchFormState = {
  city: "",
  priceMax: "",
  priceM2Max: "",
  roomsFrom: "",
  keywords: "",
  aiScoring: true,
};

const Index = () => {
  const [form, setForm] = useState<SearchFormState>(initialState);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFieldChange = (field: keyof SearchFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    if (!form.city.trim()) {
      toast({
        title: "Chybí město",
        description: "Prosím zadejte alespoň město, které vás zajímá.",
        variant: "destructive",
      });
      return;
    }

    const params = new URLSearchParams();
    params.set("city", form.city.trim());
    if (form.priceMax) params.set("priceMax", form.priceMax.trim());
    if (form.priceM2Max) params.set("priceM2Max", form.priceM2Max.trim());
    if (form.roomsFrom) params.set("roomsFrom", form.roomsFrom.trim());
    if (form.keywords) params.set("keywords", form.keywords.trim());
    params.set("aiScoring", form.aiScoring ? "1" : "0");

    navigate(`/results?${params.toString()}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSearch();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Inteligentní vyhledávač nemovitostí
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Vyplňte parametry hledání a získáte vyfiltrované nabídky včetně AI hodnocení.
          </p>
        </div>

        {/* Search Card */}
        <Card className="p-6 md:p-8 shadow-lg border-0 animate-scale-in">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">Město *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  placeholder="Např. Praha"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roomsFrom">Dispozice od</Label>
                <Input
                  id="roomsFrom"
                  type="number"
                  min="1"
                  value={form.roomsFrom}
                  onChange={(e) => handleFieldChange("roomsFrom", e.target.value)}
                  placeholder="Např. 2"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceMax">Maximální cena (Kč)</Label>
                <Input
                  id="priceMax"
                  type="number"
                  min="0"
                  value={form.priceMax}
                  onChange={(e) => handleFieldChange("priceMax", e.target.value)}
                  placeholder="Např. 6000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceM2Max">Cena za m² (Kč)</Label>
                <Input
                  id="priceM2Max"
                  type="number"
                  min="0"
                  value={form.priceM2Max}
                  onChange={(e) => handleFieldChange("priceM2Max", e.target.value)}
                  placeholder="Např. 120000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Klíčová slova (odděleno čárkou)</Label>
              <Textarea
                id="keywords"
                value={form.keywords}
                onChange={(e) => handleFieldChange("keywords", e.target.value)}
                placeholder="rekonstrukce, balkon, parkování"
                className="min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div>
                <p className="font-medium">Zapnout AI hodnocení</p>
                <p className="text-sm text-muted-foreground">
                  Po vyhledání necháme GPT vybrat nejlepší příležitosti (0-100).
                </p>
              </div>
              <Switch
                checked={form.aiScoring}
                onCheckedChange={(checked) => handleFieldChange("aiScoring", checked)}
              />
            </div>

            <Button type="submit" size="lg" className="w-full md:w-auto font-medium gap-2">
              <Search className="h-4 w-4" />
              Vyhledat nemovitosti
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Index;
