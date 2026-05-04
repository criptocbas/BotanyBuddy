import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-200">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold mb-1">
              Something went sideways
            </h1>
            <p className="text-sm text-muted-foreground">
              BotanyBuddy hit an unexpected error. Reloading usually clears it.
            </p>
          </div>
          {error.message && (
            <pre className="text-left text-[11px] text-muted-foreground bg-muted/40 rounded-md p-3 overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
          <Button onClick={this.reload}>
            <RotateCcw className="h-4 w-4" /> Reload
          </Button>
        </div>
      </div>
    );
  }
}
