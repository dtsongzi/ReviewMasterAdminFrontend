// 路由级错误边界：捕获子树渲染/生命周期异常，避免任意页面异常导致整页白屏。
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 开发排障保留控制台堆栈；界面只展示简要信息，不暴露内部细节。
    console.error('页面渲染异常', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="boot error-boundary">
        <h1>页面出错了</h1>
        <p className="muted">加载页面时发生异常，请重新加载后重试。</p>
        <p className="error-box">{error.message || '未知错误'}</p>
        <button type="button" className="btn-primary" onClick={this.reload}>重新加载</button>
      </div>
    );
  }
}
