"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
};

type State = { failed: boolean };

/**
 * useGLTF·WebGL·GLB 파싱 실패가 점사 플로우 전체를 중단하지 않도록 격리.
 * Suspense는 suspend만 처리하고 fetch/파싱 오류는 ErrorBoundary가 필요함.
 */
export class MascotGlbErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error) {}

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
