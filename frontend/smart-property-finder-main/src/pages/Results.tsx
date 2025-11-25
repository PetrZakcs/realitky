import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api";

interface DerivedAttributes {
  pricePerM2?: number;
  sizeM2?: number;
  layoutLabel?: string;
}

interface PropertyResult {
  id: string;
  title: string;
  url: string;
  location?: string;
  price?: number;
  sizeM2?: number;
  rooms?: number;
  derived: DerivedAttributes;
  aiScore?: number;
  aiReason?: string;
  aiHighlights?: string[];
}

type SearchApiResponse = {
  searchId: string;
  results: PropertyResult[];
};

type SearchRequestPayload = {
  city: string;
  priceMax?: number;
  priceM2Max?: number;
  roomsFrom?: number;
  keywords?: string[];
  aiScoring?: boolean;
};

const buildSearchPayload = (params: URLSearchParams): SearchRequestPayload | null => {
  const city = params.get("city")?.trim();
  if (!city) {
    return null;
  }

  const parseNumber = (value: string | null) => {
    if (!value) return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  const keywordsRaw = params.get("keywords");
  const keywords = keywordsRaw
    ? keywordsRaw
        .split(",")
        .map((kw) => kw.trim())
        .filter(Boolean)
    : undefined;

  return {
    city,
    priceMax: parseNumber(params.get("priceMax")),
    priceM2Max: parseNumber(params.get("priceM2Max")),
    roomsFrom: parseNumber(params.get("roomsFrom")),
    keywords,
    aiScoring: params.get("aiScoring") !== "0",
  };
};

const formatCurrency = (value?: number) => {
  if (!value && value !== 0) return "Neuvedeno";
  return value.toLocaleString("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  });
};

const formatNumber = (value?: number, suffix = "") => {
  if (!value && value !== 0) return "Neuvedeno";
  return `${value.toLocaleString("cs-CZ")} ${suffix}`.trim();
};

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramsKey = searchParams.toString();
  const payload = useMemo(
    () => buildSearchPayload(new URLSearchParams(paramsKey)),
    [paramsKey]
  );

  const [results, setResults] = useState<PropertyResult[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!payload) {
      navigate("/");
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(resolveApiUrl("/api/search"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Chyba při vyhledávání");
        }

        const data = (await response.json()) as SearchApiResponse;
        setResults(data.results || []);
        setSearchId(data.searchId);

        if (!data.results?.length) {
          toast({
            title: "Žádné výsledky",
            description: "Zkuste upravit parametry hledání.",
          });
        }
      } catch (error) {
        console.error("Search error:", error);
        toast({
          title: "Chyba",
          description: "Nepodařilo se vyhledat nemovitosti. Zkuste to prosím znovu.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [payload, navigate, toast]);

  const activeFilters = payload
    ? ([
        payload.priceMax ? `Cena do ${formatCurrency(payload.priceMax)}` : null,
        payload.priceM2Max ? `Cena/m² do ${formatCurrency(payload.priceM2Max)}` : null,
        payload.roomsFrom ? `Min. ${payload.roomsFrom}+kk` : null,
        payload.keywords?.length ? `Klíčová slova: ${payload.keywords.join(", ")}` : null,
        payload.aiScoring ? "AI scoring zapnutý" : "AI scoring vypnutý",
      ].filter(Boolean) as string[])
    : [];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap animate-fade-in">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zpět
            </Button>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Hledání</p>
              <h1 className="text-2xl md:text-3xl font-bold">
                {payload?.city || "Neznámé město"}
              </h1>
              {searchId && (
                <p className="text-xs text-muted-foreground mt-1">ID hledání: {searchId}</p>
              )}
            </div>
          </div>
          {payload && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="secondary">
                  {filter}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {isLoading && (
          <Card className="p-12 shadow-lg border-0 animate-fade-in">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="text-muted-foreground">Vyhledávám nemovitosti...</p>
            </div>
          </Card>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((result) => (
              <Card key={result.id} className="p-6 shadow-lg border-0 animate-fade-in">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold">{result.title}</h2>
                        {result.location && (
                          <p className="text-sm text-muted-foreground">{result.location}</p>
                        )}
                      </div>
                      {typeof result.aiScore === "number" && (
                        <div className="text-right">
                          <p className="text-xs uppercase text-muted-foreground">AI skóre</p>
                          <p className="text-4xl font-bold text-primary">{result.aiScore}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground uppercase">Cena</p>
                        <p className="font-semibold">{formatCurrency(result.price)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground uppercase">Výmera</p>
                        <p className="font-semibold">
                          {formatNumber(result.sizeM2 || result.derived?.sizeM2, "m²")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground uppercase">Cena / m²</p>
                        <p className="font-semibold">
                          {result.derived?.pricePerM2
                            ? `${formatCurrency(result.derived.pricePerM2)}/m²`
                            : "Neuvedeno"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {result.aiHighlights?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {result.aiHighlights.map((highlight) => (
                            <Badge key={highlight} variant="outline">
                              {highlight}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      {result.aiReason && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          AI hodnocení: {result.aiReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {result.derived?.layoutLabel && (
                      <Badge variant="secondary" className="w-fit">
                        {result.derived.layoutLabel}
                      </Badge>
                    )}
                    <Button
                      className="gap-2"
                      onClick={() => window.open(result.url, "_blank", "noopener")}
                    >
                      Detail nabídky
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && results.length === 0 && (
          <Card className="p-12 shadow-lg border-0 animate-fade-in text-center space-y-4">
            <p className="text-lg text-muted-foreground">
              Nenašli jsme žádné nemovitosti odpovídající zadaným filtrům.
            </p>
            <Button onClick={() => navigate("/")}>Zkusit nové vyhledávání</Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Results;
