import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Play,
  Tags,
  Type,
  Users,
} from "lucide-react";

import QuizLogo from "@/components/QuizLogo";
import CategorySuggestions from "@/components/CategorySuggestions";
import {
  Button,
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
import { errorMessage } from "@/services/http";
import {
  generateQuiz,
  generateQuizFromCategory,
  generateQuizFromPdf,
  getCategories,
  getModels,
} from "@/services/quizApi";
import { clearSoloResult, saveSoloRun } from "@/features/quiz/soloRunStore";
import type { SoloRun } from "@/features/quiz/useSinglePlayerQuiz";
import { DIFFICULTIES, type Difficulty, type Quiz } from "@/types/api";

type Source = "topic" | "pdf" | "category";

const SOURCES: ReadonlyArray<{ id: Source; label: string; icon: typeof Type }> = [
  { id: "topic", label: "Topic", icon: Type },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "category", label: "Category", icon: Tags },
];

const MAX_PDF_MB = 10;

export default function Home() {
  const navigate = useNavigate();

  const [source, setSource] = useState<Source>("topic");
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(20);
  const [includeImages, setIncludeImages] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: ({ signal }) => getModels(signal),
    staleTime: 5 * 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 10 * 60_000,
    enabled: source === "category",
  });

  // Adopt the server's default model once, without clobbering a later choice.
  useEffect(() => {
    if (model !== null) return;
    const data = modelsQuery.data;
    if (!data) return;
    setModel(data.default ?? data.models[0]?.key ?? null);
  }, [model, modelsQuery.data]);

  const models = modelsQuery.data?.models ?? [];
  const categories = categoriesQuery.data?.categories ?? [];
  const needsModel = source !== "category";
  const noModels = needsModel && modelsQuery.isSuccess && models.length === 0;

  const onPickFile = (next: File | null) => {
    setFieldError(null);
    if (next && next.size > MAX_PDF_MB * 1024 * 1024) {
      setFile(null);
      setFieldError(`That PDF is larger than ${MAX_PDF_MB} MB.`);
      return;
    }
    setFile(next);
  };

  const validate = (): string | null => {
    if (source === "topic" && !topic.trim()) return "Give the quiz a topic.";
    if (source === "pdf" && !file) return "Choose a PDF to build questions from.";
    if (source === "category" && !category.trim()) return "Pick or type a category.";
    return null;
  };

  const start = async () => {
    const problem = validate();
    setFieldError(problem);
    if (problem) return;

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setGenerating(true);
    setError(null);

    try {
      let quiz: Quiz;
      if (source === "pdf" && file) {
        quiz = await generateQuizFromPdf(
          {
            file,
            difficulty,
            num_questions: numQuestions,
            include_images: includeImages,
            model,
          },
          controller.signal,
        );
      } else if (source === "category") {
        quiz = await generateQuizFromCategory(
          {
            category: category.trim(),
            num_questions: numQuestions,
            difficulty,
          },
          controller.signal,
        );
      } else {
        quiz = await generateQuiz(
          {
            topic: topic.trim(),
            difficulty,
            num_questions: numQuestions,
            include_images: includeImages,
            model,
          },
          controller.signal,
        );
      }

      if (quiz.questions.length === 0) {
        setError("That produced no questions. Try a different topic or category.");
        return;
      }

      const run: SoloRun = {
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        secondsPerQuestion,
        questions: quiz.questions,
      };
      saveSoloRun(run);
      clearSoloResult();
      navigate("/quiz", { state: { run } });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(errorMessage(caught, "Could not build that quiz."));
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  };

  const modelNote = useMemo(() => {
    if (!needsModel) return null;
    if (modelsQuery.isLoading) return "Checking which models are available…";
    if (modelsQuery.isError) {
      return errorMessage(modelsQuery.error, "Could not load the model list.");
    }
    if (models.length === 0) {
      return "No language model is configured on the server. Category quizzes still work.";
    }
    return null;
  }, [models.length, modelsQuery.error, modelsQuery.isError, modelsQuery.isLoading, needsModel]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:px-5">
      {/* Blocking overlay: generation can take a while and a second submit would
          throw the first result away. Deliberately CSS-only — the landing page
          should not have to download an animation library to show a spinner. */}
      {generating ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-overlay flex items-center justify-center bg-scrim p-4"
        >
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-ink-line bg-ink-raised px-6 py-5 shadow-hard">
            <Loader2
              className="h-8 w-8 text-acid motion-safe:animate-spin"
              aria-hidden="true"
            />
            <p className="font-display text-lg uppercase tracking-display">
              Building your quiz
            </p>
            <p className="max-w-[16rem] text-center text-xs text-bone-dim">
              Generating questions can take up to a minute.
            </p>
          </div>
        </div>
      ) : null}

      <header className="flex flex-col items-center gap-3 text-center">
        <QuizLogo size={56} className="text-acid" />
        <h1 className="font-display text-4xl uppercase leading-none tracking-tightest sm:text-6xl">
          Quizzatron
        </h1>
        <p className="max-w-prose text-sm text-bone-dim sm:text-base">
          Buzzer-style trivia on any subject. Play solo against the clock, or race
          your friends in a live lobby.
        </p>
      </header>

      <Panel as="section" padded="md">
        <PanelHeader>
          <PanelTitle as="h2">New quiz</PanelTitle>
        </PanelHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
        >
          <fieldset disabled={generating} className="flex flex-col gap-5">
            <legend className="sr-only">Quiz settings</legend>

            <div>
              <span
                id="source-label"
                className="mb-2 block font-sans text-[11px] font-bold uppercase tracking-widest text-bone-dim"
              >
                Build it from
              </span>
              <div
                role="radiogroup"
                aria-labelledby="source-label"
                className="grid grid-cols-3 gap-2"
              >
                {SOURCES.map(({ id, label, icon: Icon }) => {
                  const active = source === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setSource(id);
                        setFieldError(null);
                      }}
                      className={cn(
                        "flex min-h-touch flex-col items-center justify-center gap-1 rounded border-2 border-ink-line px-2 py-2",
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

            {source === "topic" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="The Roman empire, 90s pop, organic chemistry…"
                  autoComplete="off"
                  aria-describedby={fieldError ? "field-error" : undefined}
                />
              </div>
            ) : null}

            {source === "pdf" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pdf">PDF</Label>
                <Input
                  id="pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
                  aria-describedby="pdf-hint"
                  className="py-2.5"
                />
                <p id="pdf-hint" className="text-xs text-bone-dim">
                  Up to {MAX_PDF_MB} MB. The server reads the text and works out
                  the topic itself.
                </p>
                {file ? (
                  <p className="break-all text-xs font-semibold text-go">
                    {file.name}
                  </p>
                ) : null}
              </div>
            ) : null}

            {source === "category" ? (
              <div className="relative flex flex-col gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Let a click on a suggestion land before hiding the list.
                    window.setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  placeholder="History, Film, Science…"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showSuggestions}
                  aria-controls="category-suggestions"
                />
                <div id="category-suggestions">
                  <CategorySuggestions
                    categories={categories}
                    searchQuery={category}
                    visible={showSuggestions}
                    onSelectCategory={(_, name) => {
                      setCategory(name);
                      setShowSuggestions(false);
                    }}
                  />
                </div>
                <p className="text-xs text-bone-dim" role="status" aria-live="polite">
                  {categoriesQuery.isLoading
                    ? "Loading categories…"
                    : categoriesQuery.isError
                      ? errorMessage(categoriesQuery.error, "Could not load categories.")
                      : `${categories.length} categories available.`}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span
                  id="num-questions-label"
                  className="block font-sans text-[11px] font-bold uppercase tracking-widest text-bone-dim"
                >
                  Questions: <span className="text-acid">{numQuestions}</span>
                </span>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={[numQuestions]}
                  onValueChange={([value]) => setNumQuestions(value)}
                  aria-labelledby="num-questions-label"
                  thumbLabel="Number of questions"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span
                  id="seconds-label"
                  className="block font-sans text-[11px] font-bold uppercase tracking-widest text-bone-dim"
                >
                  Seconds per question:{" "}
                  <span className="text-acid">{secondsPerQuestion}</span>
                </span>
                <Slider
                  min={5}
                  max={60}
                  step={5}
                  value={[secondsPerQuestion]}
                  onValueChange={([value]) => setSecondsPerQuestion(value)}
                  aria-labelledby="seconds-label"
                  thumbLabel="Seconds per question"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select
                  value={difficulty}
                  onValueChange={(value) => setDifficulty(value as Difficulty)}
                >
                  <SelectTrigger id="difficulty">
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

              {needsModel && models.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={model ?? undefined}
                    onValueChange={(value) => setModel(value)}
                  >
                    <SelectTrigger id="model">
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

            {needsModel ? (
              <div className="flex items-center justify-between gap-3 rounded border-2 border-ink-line bg-ink-sunken p-3">
                <Label htmlFor="images" className="flex items-center gap-2 normal-case">
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  Picture rounds
                </Label>
                <Switch
                  id="images"
                  checked={includeImages}
                  onCheckedChange={setIncludeImages}
                  aria-label="Include picture questions"
                />
              </div>
            ) : null}

            {modelNote ? (
              <p className="text-xs text-bone-dim" role="status" aria-live="polite">
                {modelNote}
              </p>
            ) : null}

            {fieldError ? (
              <p
                id="field-error"
                role="alert"
                className="flex items-center gap-2 text-sm font-semibold text-hot"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {fieldError}
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded border-2 border-ink-line bg-hot p-3 text-sm font-semibold text-ink"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-words">{error}</span>
              </p>
            ) : null}

            <Button type="submit" size="lg" block disabled={generating || noModels}>
              {generating ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {generating ? "Building…" : "Start quiz"}
            </Button>

            <p className="text-xs text-bone-dim">
              Generating questions from a topic or a PDF can take up to a minute.
            </p>
          </fieldset>
        </form>
      </Panel>

      <Panel as="section" padded="md" className="flex flex-col gap-3">
        <PanelTitle as="h2">Play with friends</PanelTitle>
        <p className="text-sm text-bone-dim">
          Create a lobby, share the six-character code, and race everyone to the
          buzzer.
        </p>
        <Button asChild variant="secondary" size="lg" block>
          <Link to="/multiplayer">
            <Users aria-hidden="true" />
            Multiplayer
          </Link>
        </Button>
      </Panel>
    </div>
  );
}
