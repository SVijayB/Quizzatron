import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button, Panel } from "@/components/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  message: string | null;
}

/**
 * The app's single error boundary.
 *
 * v1 had none, and instead suppressed failures on purpose: an `ignoreAllErrors`
 * flag that swallowed everything for five seconds after a route change, plus a
 * six-substring blocklist of error messages that were silently dropped. A render
 * crash now shows the message and offers a way out.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      message:
        error instanceof Error && error.message
          ? error.message
          : "The page hit an unexpected error.",
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Nothing to report to: there is no error-tracking backend, and logging to
    // the console is not a recovery strategy.
  }

  private reset = () => {
    this.setState({ message: null });
  };

  render(): ReactNode {
    const { message } = this.state;
    if (message === null) return this.props.children;

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pt-8 sm:px-5">
        <Panel as="section" padded="lg" className="flex flex-col gap-4">
          <h1 className="font-display text-2xl uppercase tracking-display">
            Something broke
          </h1>
          <p role="alert" className="break-words text-sm text-bone">
            {message}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={this.reset}>Try again</Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.assign("/");
              }}
            >
              Back to home
            </Button>
          </div>
        </Panel>
      </div>
    );
  }
}
