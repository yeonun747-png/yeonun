"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** console.warn 라벨 */
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

  componentDidCatch(error: Error) {
    console.warn("[mascot-glb]", this.props.label ?? "load", error.message);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
