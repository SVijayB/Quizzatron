import { useEffect, useState } from "react";
import { Image as ImageIcon, Lock, Tags, Type } from "lucide-react";

import CategorySuggestions from "@/components/CategorySuggestions";
import {
  Input,
  Label,
  Panel,
  PanelHeader,
  PanelTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  DIFFICULTIES,
  SETTINGS_LIMITS,
  type Category,
  type Difficulty,
  type LobbySettings,
  type ModelInfo,
} from "@/types/api";

interface LobbySettingsFormProps {
  settings: LobbySettings;
  /** True for everyone but the host, and once the game has started. */
  readOnly: boolean;
  onChange: (patch: Partial<LobbySettings>) => void;
  models: ModelInfo[];
  categories: Category[];
}

/**
 * Host controls. Every value is validated and range-checked server-side too
 * (1–30 questions, 5–60 seconds), so a bad value is a 400 rather than a lobby
 * with 5,000 questions.
 *
 * Sliders commit on release: dragging one used to fire a settings broadcast per
 * pixel.
 */
export function LobbySettingsForm({
  settings,
  readOnly,
  onChange,
  models,
  categories,
}: LobbySettingsFormProps) {
  const [numQuestions, setNumQuestions] = useState(settings.numQuestions);
  const [timePerQuestion, setTimePerQuestion] = useState(settings.timePerQuestion);
  const [topic, setTopic] = useState(settings.topic ?? "");
  const [category, setCategory] = useState(settings.category ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mode, setMode] = useState<"topic" | "category">(
    settings.category ? "category" : "topic",
  );

  // The server is the authority; mirror whatever it last told us.
  useEffect(() => setNumQuestions(settings.numQuestions), [settings.numQuestions]);
  useEffect(() => setTimePerQuestion(settings.timePerQuestion), [settings.timePerQuestion]);
  useEffect(() => setTopic(settings.topic ?? ""), [settings.topic]);
  useEffect(() => setCategory(settings.category ?? ""), [settings.category]);

  return (
    <Panel as="section" padded="md">
      <PanelHeader>
        <PanelTitle as="h2" className="text-lg sm:text-xl">
          Game settings
        </PanelTitle>
        {readOnly ? (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-bone-dim">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Host only
          </span>
        ) : null}
      </PanelHeader>

      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        <legend className="sr-only">Game settings</legend>

        <div>
          <span
            id="lobby-source-label"
            className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-bone-dim"
          >
            Questions from
          </span>
          <div
            role="radiogroup"
            aria-labelledby="lobby-source-label"
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                { id: "topic" as const, label: "Topic", icon: Type },
                { id: "category" as const, label: "Category", icon: Tags },
              ]
            ).map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setMode(id);
                    onChange(
                      id === "topic"
                        ? { category: null, topic: topic.trim() || null }
                        : { topic: null, category: category.trim() || null },
                    );
                  }}
                  className={cn(
                    "flex min-h-touch items-center justify-center gap-2 rounded border-2 border-ink-line px-3",
                    "text-xs font-bold uppercase tracking-wide transition-colors duration-fast ease-out",
                    active
                      ? "bg-acid text-ink shadow-hard-sm"
                      : "bg-ink-sunken text-bone-dim hover:text-bone",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "topic" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="lobby-topic">Topic</Label>
            <Input
              id="lobby-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              onBlur={() => onChange({ topic: topic.trim() || null, category: null })}
              placeholder="Anything at all"
              autoComplete="off"
            />
            <p className="text-xs text-bone-dim">
              Leave it blank for general knowledge.
            </p>
          </div>
        ) : (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor="lobby-category">Category</Label>
            <Input
              id="lobby-category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 150);
                onChange({ category: category.trim() || null, topic: null });
              }}
              placeholder="History, Film, Science…"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
            />
            <CategorySuggestions
              categories={categories}
              searchQuery={category}
              visible={showSuggestions && !readOnly}
              onSelectCategory={(_, name) => {
                setCategory(name);
                setShowSuggestions(false);
                onChange({ category: name, topic: null });
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span
              id="lobby-questions-label"
              className="block font-sans text-[11px] font-bold uppercase tracking-widest text-bone-dim"
            >
              Questions: <span className="text-acid">{numQuestions}</span>
            </span>
            <Slider
              min={SETTINGS_LIMITS.numQuestions.min}
              max={SETTINGS_LIMITS.numQuestions.max}
              step={1}
              value={[numQuestions]}
              onValueChange={([value]) => setNumQuestions(value)}
              onValueCommit={([value]) => onChange({ numQuestions: value })}
              aria-labelledby="lobby-questions-label"
              thumbLabel="Number of questions"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span
              id="lobby-time-label"
              className="block font-sans text-[11px] font-bold uppercase tracking-widest text-bone-dim"
            >
              Seconds per question: <span className="text-acid">{timePerQuestion}</span>
            </span>
            <Slider
              min={SETTINGS_LIMITS.timePerQuestion.min}
              max={SETTINGS_LIMITS.timePerQuestion.max}
              step={5}
              value={[timePerQuestion]}
              onValueChange={([value]) => setTimePerQuestion(value)}
              onValueCommit={([value]) => onChange({ timePerQuestion: value })}
              aria-labelledby="lobby-time-label"
              thumbLabel="Seconds per question"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lobby-difficulty">Difficulty</Label>
            <Select
              value={settings.difficulty}
              onValueChange={(value) => onChange({ difficulty: value as Difficulty })}
              disabled={readOnly}
            >
              <SelectTrigger id="lobby-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "topic" && models.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="lobby-model">Model</Label>
              <Select
                value={settings.model ?? undefined}
                onValueChange={(value) => onChange({ model: value })}
                disabled={readOnly}
              >
                <SelectTrigger id="lobby-model">
                  <SelectValue placeholder="Server default" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((entry) => (
                    <SelectItem key={entry.key} value={entry.key}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {mode === "topic" ? (
          <div className="flex items-center justify-between gap-3 rounded border-2 border-ink-line bg-ink-sunken p-3">
            <Label htmlFor="lobby-images" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              Picture rounds
            </Label>
            <Switch
              id="lobby-images"
              checked={settings.includeImages}
              onCheckedChange={(checked) => onChange({ includeImages: checked })}
              aria-label="Include picture questions"
              disabled={readOnly}
            />
          </div>
        ) : null}
      </fieldset>
    </Panel>
  );
}
