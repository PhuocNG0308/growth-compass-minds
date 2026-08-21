import { Component, type ReactNode } from 'react';

/**
 * Without this a render throw leaves a blank white page, which reads as "the product is
 * broken" rather than "this screen is". Class component because React has no hook for it.
 */
export class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[render]', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-medium">Something on this screen broke.</p>
          <button
            onClick={() => location.reload()}
            className="border-input hover:bg-accent focus-visible:ring-ring/50 mt-6 rounded-md border px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
